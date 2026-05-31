import { Platform } from 'react-native';

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
};

const API_URL = getApiUrl();

if (!API_URL) {
  console.warn('No se pudo determinar API_URL.');
}
const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';

// Rotating mock cases for presentation
let mockCaseCounter = 0;

const normalizeScanResult = (data) => {
  if (!data) return data;

  const nestedAdapted = data.adapted || {};
  const nestedOriginal = data.original || {};
  const allergens = data.allergens || nestedAdapted.allergens || [];
  const additives = data.additives || nestedAdapted.additives || [];
  const adaptedText = data.adaptedText || nestedAdapted.text || '';
  const originalText = data.originalText || data.extractedText || nestedOriginal.text || '';

  return {
    ...data,
    adaptedText,
    extractedText: originalText,
    originalText,
    productType: data.productType || 'unknown',
    minerals: data.minerals || [],
    additives,
    allergens,
    graphicalElements: data.graphicalElements || nestedAdapted.quantities || [],
    additivesDetected: additives.map((additive) => (
      typeof additive === 'string' ? additive : additive.code
    )),
    allergensDetected: allergens.map((allergen) => (
      typeof allergen === 'string' ? allergen : allergen.name
    )),
    difficultyLevel: data.difficultyLevel ?? nestedAdapted.score ?? 0,
  };
};

const MOCK_CASES = [
  {
    success: true,
    data: {
      productType: 'food',
      original: {
        text: "Ingredientes: agua, azucar, acido citrico (E330), aromas naturales, cacahuete, benzoato sodico.",
        lines: ["Ingredientes: agua, azucar,", "acido citrico (E330), aromas naturales,", "cacahuete, benzoato sodico."],
        confidence: 0.98
      },
      adapted: {
        text: "Contiene agua, azucar, acido citrico, aromas naturales, cacahuete y conservante.",
        quantities: [],
        allergens: [{ name: "cacahuete", severity: "high" }],
        additives: [
          { code: "E330", name: "Acido citrico", category: "Corrector de acidez", safe: true },
          { code: "E211", name: "Benzoato sodico", category: "Conservante", safe: true }
        ],
        score: 4.2
      }
    }
  },
  {
    success: true,
    data: {
      productType: 'water',
      original: {
        text: "Agua mineral natural de mineralizacion debil. Conservar en lugar fresco y seco.",
        lines: ["Agua mineral natural de mineralizacion debil.", "Conservar en lugar fresco y seco."],
        confidence: 0.99
      },
      adapted: {
        text: "Agua mineral natural. Guarda la botella en un lugar fresco y seco.",
        quantities: [],
        allergens: [],
        additives: [],
        score: 1.5
      }
    }
  },
  {
    success: false,
    errorMsg: "La imagen no se ve clara. Vuelve a escanear la etiqueta."
  }
];

export const uploadLabelImage = async (imageUri, imageBase64) => {
  if (USE_MOCK_API) {
    // 1. Prepare connection (simulate network delay)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. Return rotating fake data for testing all cases
    const currentCase = MOCK_CASES[mockCaseCounter % MOCK_CASES.length];
    mockCaseCounter++; // Rotate to the next case for the next scan

    if (!currentCase.success) {
      throw new Error(currentCase.errorMsg);
    }
    return normalizeScanResult(currentCase.data);
  }

  // Ensure the base64 string doesn't contain the data URI prefix (e.g. data:image/jpeg;base64,)
  const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;

  // Real connection (currently bypassed by USE_MOCK_API)
  const payload = {
    userId: 'test-user',
    deviceOS: Platform.OS === 'ios' ? 'iOS' : 'Android',
    imagePayload: rawBase64,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(`${API_URL}/v1/ingredients/analyze`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Environment-driven development/local JWT
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_DEV_JWT || ''}`
      },
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || 'No se pudo analizar la etiqueta.');
    }

    const json = await response.json();
    return normalizeScanResult(json.data);
  } catch (error) {
    throw error;
  }
};
