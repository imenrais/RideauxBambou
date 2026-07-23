export const MATRICULE_FISCALE_FORMAT = "1234567/A/A/M/000";

export const MATRICULE_FISCALE_INVALID_ERROR = `Le matricule fiscale doit respecter le format ${MATRICULE_FISCALE_FORMAT}.`;

/**
 * Keep only characters that fit the Tunisian MF pattern:
 * 7 digits + 3 letters + 3 digits (no slashes).
 * Digits are rejected in letter slots and letters in digit slots.
 */
export const normalizeMatriculeFiscale = (value: string) => {
  const cleaned = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  let result = "";

  for (const char of cleaned) {
    const length = result.length;
    if (length < 7) {
      if (/\d/.test(char)) {
        result += char;
      }
      continue;
    }
    if (length < 10) {
      if (/[A-Z]/.test(char)) {
        result += char;
      }
      continue;
    }
    if (length < 13) {
      if (/\d/.test(char)) {
        result += char;
      }
    }
  }

  return result;
};

/**
 * Display form with slashes inserted as soon as a segment is complete,
 * so the next slash appears before the user types the following part.
 * Example progressing values: "1234567/" → "1234567/A/" → "1234567/A/B/" → "1234567/A/B/C/" → "1234567/A/B/C/000"
 */
export const formatMatriculeFiscale = (value: string) => {
  const normalized = normalizeMatriculeFiscale(value);
  if (!normalized) {
    return "";
  }

  const digitsHead = normalized.slice(0, 7);
  if (digitsHead.length < 7) {
    return digitsHead;
  }

  const letter1 = normalized.slice(7, 8);
  let formatted = `${digitsHead}/`;
  if (!letter1) {
    return formatted;
  }

  const letter2 = normalized.slice(8, 9);
  formatted += `${letter1}/`;
  if (!letter2) {
    return formatted;
  }

  const letter3 = normalized.slice(9, 10);
  formatted += `${letter2}/`;
  if (!letter3) {
    return formatted;
  }

  const digitsTail = normalized.slice(10, 13);
  formatted += `${letter3}/`;
  if (!digitsTail) {
    return formatted;
  }

  return `${formatted}${digitsTail}`;
};

/**
 * Apply an input change while supporting backspace over auto-inserted slashes.
 */
export const applyMatriculeFiscaleInput = (previousValue: string, nextValue: string) => {
  const previousNormalized = normalizeMatriculeFiscale(previousValue);
  const nextNormalized = normalizeMatriculeFiscale(nextValue);

  // Deleting only a trailing slash → remove the last meaningful character instead.
  if (
    nextValue.length < previousValue.length &&
    nextNormalized === previousNormalized &&
    previousNormalized.length > 0
  ) {
    return formatMatriculeFiscale(previousNormalized.slice(0, -1));
  }

  return formatMatriculeFiscale(nextNormalized);
};

export const isValidMatriculeFiscale = (value: string) =>
  /^\d{7}[A-Z]{3}\d{3}$/.test(normalizeMatriculeFiscale(value));

export const getMatriculeFiscaleValidationError = (value: string) => {
  const normalized = normalizeMatriculeFiscale(value);
  if (!normalized) {
    return "Le matricule fiscale est requis.";
  }
  if (!isValidMatriculeFiscale(normalized)) {
    return MATRICULE_FISCALE_INVALID_ERROR;
  }
  return "";
};

export const formatMatriculeFiscaleForDisplay = (value: string) => {
  const normalized = normalizeMatriculeFiscale(value);
  if (!normalized) {
    return "";
  }
  if (!isValidMatriculeFiscale(normalized)) {
    return formatMatriculeFiscale(normalized) || value.trim();
  }
  return formatMatriculeFiscale(normalized);
};
