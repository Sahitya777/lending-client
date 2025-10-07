function formatNumberWithSubscriptZeros(num: string | number): string {
  const subscriptDigits = [
    "₀",
    "₁",
    "₂",
    "₃",
    "₄",
    "₅",
    "₆",
    "₇",
    "₈",
    "₉",
    "₁₀",
    "₁₁",
    "₁₂",
    "₁₃",
    "₁₄",
    "₁₅",
    "₁₆",
    "₁₇",
    "₁₈",
  ];
  let numStr = num.toString();
  const [integerPart, fractionalPart] = numStr.split(".");
  if (!fractionalPart || fractionalPart === "0") {
    return integerPart;
  }
  let leadingZeros = 0;
  while (fractionalPart[leadingZeros] === "0") {
    leadingZeros++;
  }
  if (leadingZeros < 4) {
    return numStr.substring(0, 6);
  }
  const significantDigits = fractionalPart.slice(leadingZeros);
  const subscriptDigit = subscriptDigits[leadingZeros] || "₀";
  return `${integerPart}.0${subscriptDigit}${significantDigits.slice(0, 4)}`;
}

const numberFormatter = (input: any) => {
  if (input === null) return "";
  var number = parseFloat(input);

  if (isNaN(number)) {
    return "Invalid input";
  }

  var suffixes = [
    "",
    "K",
    "M",
    "B",
    "T",
    "Qa",
    "Qi",
    "Sx",
    "Sp",
    "Oc",
    "No",
    "Dc",
    "Un",
  ];
  var magnitude = 0;
  while (Math.abs(number) >= 1000) {
    magnitude++;
    number /= 1000.0;
  }

  // Format the number with the appropriate magnitude and suffix
  ////console.log(
  //   "decimals ",
  //   5 - (Math.log10(96.95) + 1),
  //   Math.floor(Math.max(5 - Math.max(1, Math.log10(96.95) + 1), 0))
  // );
  var formattedNumber =
    magnitude < 1
      ? formatNumberWithSubscriptZeros(input)
      : // .replace(/\.?0+$/, "") // Remove trailing zeros and decimal point if unnecessary
        number?.toFixed(
          Math.max(4 - Math.floor(Math.max(1, Math.log10(number) + 1)), 0)
        );
  // .replace(/\.?0+$/, ""); // Remove trailing zeros and decimal point if unnecessary
  return formattedNumber + suffixes[magnitude];
};
////console.log("hey");
////console.log(formatNumber(2028222220.2222));
////console.log(formatNumber(2022));
export default numberFormatter;
