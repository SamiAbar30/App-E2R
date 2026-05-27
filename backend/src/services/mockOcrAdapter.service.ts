import { IOcrProvider } from './ocrAdapter.service';
import { OcrResult } from '../types';

export class MockOcrAdapter implements IOcrProvider {
  async extract(base64: string): Promise<OcrResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const rawText = "CABREIROA 65 PROYECTO ORIGEN BOTELLA HECHA CON MATERIAL 100% RECICLADO. MÁS INFO EN CABREIROA.ES/ORIGEN Composición Analítica / Composição Analitica (mg/l): 174 (Residuo seco/resíduo fixo), 189,7 (HCO3), 57,9 (Na), 24,6 (SiO2), 6,7 (Cl), 4,9 (Ca), 34 (Mg), 3,2 (K), 0,88 (F\"), 0,19 (Li). pH: 7,1 Lab. Dr. Oliver Rodés, Septiembre/ Setembro 2022. Conservar en lugar fresco y seco. Sin luz solar ni olores agresivos. Conservar em local fresco e seco. Sem luz solar ou odores agressivos. Agua mineral natural de mineralización débil. Água mineral natural pouco mineralizada. MANANTIAL CABREIROA Envasada por / Embalado por: Aguas de Cabreiroá, S.A. Manantial de Cabreiroá, Estrada de Cabreiro s/n. 32600 VeríNº urense Galicia España / Espanha. Nº RGSEAA 27.01078/OR. Consumir preferentemente antes del: Ver lote./Consumir de preferência antes de: Veja o lote. Importado por Justdrinks, Lda 289393757. +34 900 117 598 EXCLUSIVO HOSTELERÍA Amarillo 50cl ORIGEN ÚNICO POR SU SEGURIDAD Nº RELLENE 421194 Certified HR B D Corporation GALICIA CALIDADE 8 411902 004089, aditivos y alérgenos: E330, E102, E120, cacahuete, soja, leche.";

    return {
      rawText,
      confidence: 0.98,
      lines: [
        "CABREIROA 65 PROYECTO ORIGEN BOTELLA HECHA CON MATERIAL 100% RECICLADO.",
        "MÁS INFO EN CABREIROA.ES/ORIGEN",
        "Composición Analítica / Composição Analitica (mg/l):",
        "174 (Residuo seco/resíduo fixo), 189,7 (HCO3), 57,9 (Na), 24,6 (SiO2), 6,7 (Cl), 4,9 (Ca), 34 (Mg), 3,2 (K), 0,88 (F\"), 0,19 (Li). pH: 7,1",
        "Lab. Dr. Oliver Rodés, Septiembre/ Setembro 2022.",
        "Conservar en lugar fresco y seco. Sin luz solar ni olores agresivos.",
        "Conservar em local fresco e seco. Sem luz solar ou odores agressivos.",
        "Agua mineral natural de mineralización débil. Água mineral natural pouco mineralizada.",
        "MANANTIAL CABREIROA",
        "Envasada por / Embalado por: Aguas de Cabreiroá, S.A.",
        "Manantial de Cabreiroá, Estrada de Cabreiro s/n. 32600 VeríNº urense Galicia España / Espanha.",
        "Nº RGSEAA 27.01078/OR.",
        "Consumir preferentemente antes del: Ver lote./Consumir de preferência antes de: Veja o lote.",
        "Importado por Justdrinks, Lda 289393757. +34 900 117 598 EXCLUSIVO HOSTELERÍA",
        "Amarillo 50cl ORIGEN ÚNICO POR SU SEGURIDAD",
        "Nº RELLENE 421194 Certified HR B D Corporation GALICIA CALIDADE",
        "8 411902 004089",
        "aditivos y alérgenos: E330, E102, E120, cacahuete, soja, leche."
      ]
    };
  }
}
