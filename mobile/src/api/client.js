import { Platform } from 'react-native';

const API_URL = process.env.API_BASE_URL; // Real backend URL (update with local IP from ipconfig if it changes)
const USE_MOCK_API = false; // Set to true for offline presentation mode

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
    const response = await fetch(`${API_URL}/v1/ingredients/analyze`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Dummy dev JWT
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3NzkzNzYwNjQsImV4cCI6NDkzNTEzNjA2NH0.5yPmXXnuSGnIWB22jYrdKN2-V90jxNzwXA1wyY45aws'
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
