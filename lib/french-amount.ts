const UNITS = [
  "",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];

const TENS = [
  "",
  "",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "soixante",
  "quatre-vingt",
  "quatre-vingt",
];

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const belowHundred = (n: number): string => {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 1 && ten !== 8) return `${TENS[ten]} et un`;
    return unit ? `${TENS[ten]}-${UNITS[unit]}` : TENS[ten];
  }
  if (n < 80) {
    const rest = n - 60;
    if (rest === 1) return "soixante et un";
    return rest ? `soixante-${UNITS[rest]}` : "soixante";
  }
  const rest = n - 80;
  if (rest === 0) return "quatre-vingts";
  return `quatre-vingt-${UNITS[rest]}`;
};

const belowThousand = (n: number): string => {
  if (n < 100) return belowHundred(n);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredWord =
    hundreds === 1 ? "cent" : rest === 0 ? `${UNITS[hundreds]} cents` : `${UNITS[hundreds]} cent`;
  return rest ? `${hundredWord} ${belowHundred(rest)}` : hundredWord;
};

const integerToFrench = (n: number): string => {
  if (n === 0) return "zéro";
  if (n < 1000) return belowThousand(n);

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const thousandWord =
    thousands === 1 ? "mille" : `${belowThousand(thousands)} mille`;
  return rest ? `${thousandWord} ${belowThousand(rest)}` : thousandWord;
};

/** Converts a TND amount into French words (dinars + millimes). */
export const amountToFrenchWordsTnd = (amount: number): string => {
  const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const rounded = Math.round(safe * 1000) / 1000;
  const dinars = Math.floor(rounded);
  const millimes = Math.round((rounded - dinars) * 1000);

  const dinarWord = dinars <= 1 ? "Dinar" : "Dinars";
  let text = `${capitalize(integerToFrench(dinars))} ${dinarWord}`;

  if (millimes > 0) {
    text += ` et ${String(millimes).padStart(3, "0")} Millimes`;
  }

  return `${text} T.T.C`;
};
