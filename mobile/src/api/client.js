import { Platform, NativeModules } from 'react-native';

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // If you are on an Android emulator, 10.0.2.2 points to your PC's localhost.
  // If you are on an iOS simulator, localhost works out of the box.
  // If you are on a physical phone, you MUST run `adb reverse tcp:3000 tcp:3000`
  // for localhost to work!
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
};

const API_URL = getApiUrl();
console.log('\n\n======================================');
console.log('API_URL RESOLVED TO:', API_URL);
console.log('SCRIPT_URL WAS:', NativeModules.SourceCode?.scriptURL);
console.log('======================================\n\n');

if (!API_URL) {
  console.warn('Warning: API_URL could not be determined.');
}
const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';

// Rotating mock cases for presentation
let mockCaseCounter = 0;

const MOCK_CASES = [
  // Case 0: Full extraction (Allergens, Additives, Quantities)
  {
    success: true,
    data: {
      original: {
        text: "Ingredients: Water, Sugar, Citric Acid (E330), Natural Flavors, Peanuts, Sodium Benzoate.",
        lines: ["Ingredients: Water, Sugar,", "Citric Acid (E330), Natural Flavors,", "Peanuts, Sodium Benzoate."],
        confidence: 0.98
      },
      adapted: {
        text: "Ingredients: Water, Sugar, Citric Acid, Natural Flavors, Peanuts, Preservative (Sodium Benzoate).",
        quantities: [],
        allergens: ["peanuts"],
        additives: [
          { code: "E330", name: "Citric Acid", function: "Acidity regulator, antioxidant" },
          { code: "E211", name: "Sodium Benzoate", function: "Preservative" }
        ],
        score: 4.2
      }
    }
  },
  // Case 1: Clean Label (No allergens, no additives)
  {
    success: true,
    data: {
      original: {
        text: "Ingredients: 100% Organic Apples, Water.",
        lines: ["Ingredients:", "100% Organic Apples, Water."],
        confidence: 0.99
      },
      adapted: {
        text: "Ingredients: Organic Apples, Water.",
        quantities: [{ original: "100%", value: 100, unit: "%", index: 13 }],
        allergens: [],
        additives: [],
        score: 1.5
      }
    }
  },
  // Case 2: Error State (Blurry or Unreadable)
  {
    success: false,
    errorMsg: "Error: Image is too blurry or text could not be recognized. Please retake the photo."
  }
];

export const uploadLabelImage = async (imageUri, imageBase64) => {
  console.log('uploadLabelImage called');
  if (USE_MOCK_API) {
    // 1. Prepare connection (simulate network delay)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. Return rotating fake data for testing all cases
    const currentCase = MOCK_CASES[mockCaseCounter % MOCK_CASES.length];
    mockCaseCounter++; // Rotate to the next case for the next scan

    if (!currentCase.success) {
      throw new Error(currentCase.errorMsg);
    }
    return currentCase.data;
  }

  // Real connection (currently bypassed by USE_MOCK_API)
  const payload = {
    userId: 'test-user',
    deviceOS: Platform.OS === 'ios' ? 'iOS' : 'Android',
    imagePayload: imageBase64,
    timestamp: new Date().toISOString()
  };

  try {
    console.log('uploadLabelImage payload:', payload);
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
      throw new Error(`API error! status: ${response.status}, msg: ${errJson.message || 'unknown'}`);
    }

    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error('uploadLabelImage error:', error);
    throw error;
  }
};
