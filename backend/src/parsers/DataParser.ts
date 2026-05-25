import { franc } from 'franc-min';

/**
 * Represents the classification of a parsed OCR line.
 */
export interface ParsedItem {
  /**
   * The semantic type of the parsed line:
   * - CHEMICAL: Identified as a chemical element (e.g., Sodium, Potassium).
   * - INGREDIENT: Identified as a food ingredient (e.g., dry residue).
   * - INSTRUCTION: Identified as a storage or usage instruction.
   * - UNKNOWN: Fallback category when no specific rules match.
   */
  type: 'CHEMICAL' | 'INGREDIENT' | 'INSTRUCTION' | 'UNKNOWN';
  /** The original text line that was classified. */
  line: string;
}

/**
 * DataParser handles the parsing and classification of raw OCR text streams.
 * It implements a dual-strategy Language Identification layer to isolate
 * Spanish text while filtering out noise and non-target languages (like Portuguese).
 * 
 * IEEE 29148 trace: COMP-004 (Data Parser)
 */
export class DataParser {
  /**
   * Toggles the language identification strategy:
   * - STOP_WORDS: Uses a predefined density scoring of common Spanish stop words.
   * - N_GRAMS: Uses statistical N-Gram analysis via 'franc' to detect Spanish.
   */
  private readonly languageStrategy: 'STOP_WORDS' | 'N_GRAMS' = 'STOP_WORDS';

  /**
   * Portuguese "bleed-markers". If any of these words are detected, the line is 
   * assumed to be Portuguese and is aggressively filtered out.
   */
  private ptMarkers = new Set(['em', 'ao', 'abrigo', 'da', 'do', 'composição', 'baixa']);

  /**
   * Chemical lookup map. Used to map chemical symbols back to their full Spanish names.
   * Helps in classifying tokens as type 'CHEMICAL'.
   */
  private chemicalMap = new Map<string, string>([
    ['na', 'Sodio'],
    ['k', 'Potasio'],
    ['cl', 'Cloruro'],
    ['ca', 'Calcio'],
    ['mg', 'Magnesio'],
    ['fe', 'Hierro'],
    ['zn', 'Zinc'],
    ['co', 'Cobalto'],
    ['ni', 'Níquel'],
    ['as', 'Arsénico'],
    ['cr', 'Cromo'],
    ['se', 'Selenio'],
    ['mo', 'Molibdeno'],
    ['cd', 'Cadmio'],
    ['pb', 'Plomo'],
    ['hg', 'Mercurio'],
    ['cn', 'Cianuro'],
    ['si', 'Silicio'],
    ['al', 'Aluminio'],
    ['cu', 'Cobre'],
    ['mn', 'Manganesio'],
    ['p', 'Fósforo'],
    ['i', 'Yodo'],
    ['se', 'Selenio'],
    ['v', 'Vanadio'],
    ['ba', 'Bario'],
    ['li', 'Litio'],
    ['ti', 'Titanio'],
    ['cr', 'Cromo'],
    ['mn', 'Manganeso'],
    ['fe', 'Hierro'],
    ['co', 'Cobalto'],
    ['ni', 'Níquel'],
    ['cu', 'Cobre'],
    ['zn', 'Zinc'],
    ['ga', 'Galio'],
    ['ge', 'Germanio'],
    ['as', 'Arsénico'],
    ['se', 'Selenio'],
    ['br', 'Bromo'],
    ['rb', 'Rubidio'],
    ['sr', 'Estroncio'],
    ['y', 'Ytrio'],
    ['zr', 'Zirconio'],
    ['nb', 'Niobio'],
    ['mo', 'Molibdeno'],
    ['tc', 'Tecnecio'],
    ['ru', 'Rutenio'],
    ['rh', 'Rodio'],
    ['pd', 'Paladio'],
    ['ag', 'Plata'],
    ['cd', 'Cadmio'],
    ['in', 'Indio'],
    ['sn', 'Estaño'],
    ['sb', 'Antimonio'],
    ['te', 'Telurio'],
    ['i', 'Yodo'],
    ['xe', 'Xenón'],
    ['cs', 'Cesio'],
    ['ba', 'Bario'],
    ['la', 'Lantano'],
    ['ce', 'Cerio'],
    ['pr', 'Praseodimio'],
    ['nd', 'Neodimio'],
    ['pm', 'Prometio'],
    ['sm', 'Samario'],
    ['eu', 'Europio'],
    ['gd', 'Gadolinio'],
    ['tb', 'Terbio'],
    ['dy', 'Disprosio'],
    ['ho', 'Holmio'],
    ['er', 'Erbio'],
    ['tm', 'Tulio'],
    ['yb', 'Iterbio'],
    ['lu', 'Lutecio'],
    ['hf', 'Hafnio'],
    ['ta', 'Tantalio'],
    ['w', 'Tungsteno'],
    ['re', 'Renio'],
    ['os', 'Osmio'],
    ['ir', 'Iridio'],
    ['pt', 'Platino'],
    ['au', 'Oro'],
    ['hg', 'Mercurio'],
    ['tl', 'Talio'],
    ['pb', 'Plomo'],
    ['bi', 'Bismuto'],
    ['po', 'Polonio'],
    ['at', 'Astato'],
    ['rn', 'Radón'],
    ['fr', 'Francio'],
    ['ra', 'Radio'],
    ['ac', 'Actinio'],
    ['th', 'Torio'],
    ['pa', 'Protactinio'],
    ['u', 'Uranio'],
    ['np', 'Neptunio'],
    ['pu', 'Plutonio'],
    ['am', 'Americio'],
    ['cm', 'Curio'],
    ['bk', 'Berkelio'],
    ['cf', 'Californio'],
    ['es', 'Einstenio'],
    ['fm', 'Fermio'],
    ['md', 'Mendelevio'],
    ['no', 'Nobelio'],
    ['lr', 'Lawrencio'],
    ['rf', 'Rutherfordio'],
    ['db', 'Dubnio'],
    ['sg', 'Seaborgio'],
    ['bh', 'Bohrio'],
    ['hs', 'Hassium'],
    ['mt', 'Meitnerio'],
    ['ds', 'Darmstadtio'],
    ['rg', 'Roentgenio'],
    ['cn', 'Copernicio'],
    ['nh', 'Nihonio'],
    ['fl', 'Flerovio'],
    ['mc', 'Moscovio'],
    ['lv', 'Livermorio'],
    ['ts', 'Teneso'],
    ['og', 'Oganesón']
  ]);

  /**
   * Spanish Stop-Words set. Used exclusively by the STOP_WORDS strategy to build
   * a density score. If the line contains these words, it has a high probability 
   * of being valid Spanish text.
   */
  private esStopWords = new Set([ 'en', 'el', 'la', 'con', 'para', 'por', 'de', 'y', 'agua', 'seco']);

  /**
   * Regex to capture numeric measurements (e.g., "10 mg/l", "5g").
   * Crucial for preventing valid quantitative data from being discarded by
   * the language filters (since numbers don't belong to a specific language).
   */
  private numericRegex = /\d+\s*(mg\/l|mg|g|ml|l|%|g\/100g|mg\/100g)\b/i;

  /**
   * Main entry point for the parser. Routes an array of raw OCR lines through the
   * selected language filtering strategy, and then classifies the surviving lines.
   * 
   * @param ocrLines - Array of raw strings obtained from the OCR service.
   * @returns An array of highly classified and verified ParsedItem objects.
   */
  public parseOcrStream(ocrLines: string[]): ParsedItem[] {
    // 1. Language Identification & Filtering (Isolate Spanish)
    const validLines = this.languageStrategy === 'STOP_WORDS'
      ? this.filterViaStopWords(ocrLines)
      : this.filterViaNGrams(ocrLines);

    // 2. Token Classification
    return this.classifyTokens(validLines);
  }

  /**
   * STRATEGY A: Stop-Word Density
   * Fast, heuristic-based approach. It discards short lines, rejects Portuguese 
   * bleed-markers, and assigns a score based on Spanish stop-words. 
   * 
   * @param lines - Array of raw text lines.
   * @returns Filtered array of lines that are highly likely to be Spanish or Measurements.
   */
  private filterViaStopWords(lines: string[]): string[] {
    return lines.filter(line => {
      const cleanLine = line.trim();
      
      // Reject extremely short lines as noise
      if (cleanLine.length < 3) return false;

      const lowerLine = cleanLine.toLowerCase();
      const words = lowerLine.split(/\s+/);
      
      // Reject if any Portuguese bleed-markers are found
      const hasPtMarker = words.some(word => this.ptMarkers.has(word));
      if (hasPtMarker) return false;

      // Calculate Spanish Stop-Word density
      let stopWordScore = 0;
      for (const word of words) {
        if (this.esStopWords.has(word)) {
          stopWordScore++;
        }
      }

      // Keep line if it contains Spanish text OR if it contains a quantitative measurement
      if (stopWordScore > 0 || this.numericRegex.test(cleanLine)) {
        return true;
      }

      return false;
    });
  }

  /**
   * STRATEGY B: N-Gram Statistical Method
   * Robust, library-based approach using 'franc'. Uses trigram analysis to
   * guess the language. Slower but potentially more accurate for complex texts.
   * 
   * @param lines - Array of raw text lines.
   * @returns Filtered array of lines that map to ISO 'spa' or contain Measurements.
   */
  private filterViaNGrams(lines: string[]): string[] {
    return lines.filter(line => {
      const cleanLine = line.trim();
      
      // franc requires at least 5 characters for accurate N-Gram generation
      if (cleanLine.length < 5) return false;

      const lowerLine = cleanLine.toLowerCase();
      const words = lowerLine.split(/\s+/);
      
      // Reject if any Portuguese bleed-markers are found (franc struggles with close languages on short strings)
      const hasPtMarker = words.some(word => this.ptMarkers.has(word));
      if (hasPtMarker) return false;

      // Execute N-Gram detection
      const isoCode = franc(cleanLine, { minLength: 5 });
      
      // Keep line if franc strictly detects Spanish OR if it contains a quantitative measurement
      if (isoCode === 'spa' || this.numericRegex.test(cleanLine)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Calculates Levenshtein distance between two strings to handle minor OCR hallucinations.
   */
  private levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) == a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1 // deletion
            )
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Analyzes the filtered, valid Spanish lines and attempts to classify them 
   * into semantic buckets (CHEMICAL, INGREDIENT, INSTRUCTION, or UNKNOWN) 
   * based on internal heuristics and dictionaries.
   * 
   * @param validLines - Array of filtered, Spanish-only or numeric-only lines.
   * @returns Array of ParsedItem interfaces ready for downstream processing.
   */
  private classifyTokens(validLines: string[]): ParsedItem[] {
    return validLines.map(line => {
      // Basic normalisation for numbers commonly confused by OCR
      let lowerLine = line.toLowerCase();
      // O->0, l->1 in potential numeric contexts, though we keep it simple for now
      
      const words = lowerLine.split(/\s+/);
      
      // 1. Check against the chemical dictionary (Fuzzy Match)
      let isChemical = false;
      for (const word of words) {
        // Exact match first
        if (this.chemicalMap.has(word)) {
          isChemical = true;
          break;
        }
        
        // Fuzzy match for longer chemical names (avoid fuzzing 1-2 char symbols to prevent false positives)
        if (word.length >= 4) {
           for (const chemVal of this.chemicalMap.values()) {
              if (this.levenshtein(word, chemVal.toLowerCase()) <= 2) {
                  isChemical = true;
                  break;
              }
           }
        }
        
        // Handle common symbol OCR errors manually since Levenshtein is dangerous on 2 chars
        if (word === 'c1' || word === 'ci') {
          // Likely 'cl' (Cloruro)
          isChemical = true; 
          break;
        }
        if (word === 'n4') {
          // Likely 'na' (Sodio)
          isChemical = true;
          break;
        }
      }

      if (isChemical) {
        return { type: 'CHEMICAL', line };
      }

      // 2. Check for specific ingredient keywords (Fuzzy)
      if (lowerLine.includes('residuo seco') || this.levenshtein(lowerLine, 'residuo seco') <= 2) {
        return { type: 'INGREDIENT', line };
      }

      // 3. Check for specific instruction keywords (Fuzzy)
      if (lowerLine.includes('conservar') || this.levenshtein(lowerLine, 'conservar') <= 2) {
        return { type: 'INSTRUCTION', line };
      }

      // 4. Default fallback
      return { type: 'UNKNOWN', line };
    });
  }
}

/**
 * Parses a raw ingredient string into structured data.
 * (Stubbed to resolve TS errors, as it was missing from the original file).
 */
export async function parseIngredientText(text: string): Promise<any> {
  return {
    ingredients: [],
    complexTermMappings: [],
    graphicalElements: []
  };
}
