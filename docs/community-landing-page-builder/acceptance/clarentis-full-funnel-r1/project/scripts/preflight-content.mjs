export function hasUnfinishedStarterContent(text) {
  return /This is a development template|Replace this starter with your approved client content|<(?:title|h1)\b[^>]*>\s*Your business\s*<\/(?:title|h1)>/i.test(text);
}
