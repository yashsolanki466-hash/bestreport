import fs from 'fs-extra';

const comprehensivePath = 'templates/report_comprehensive.ejs';
const claudePath = 'claudereport.html';

let compContent = await fs.readFile(comprehensivePath, 'utf-8');
const claudeContent = await fs.readFile(claudePath, 'utf-8');

// Extract style block from claudereport.html
const styleStartTag = '<style>';
const styleEndTag = '</style>';
const styleStartIndex = claudeContent.indexOf(styleStartTag);
const styleEndIndex = claudeContent.indexOf(styleEndTag, styleStartIndex);

if (styleStartIndex === -1 || styleEndIndex === -1) {
  throw new Error("Could not find style tags in claudereport.html");
}

const claudeStyle = claudeContent.substring(styleStartIndex, styleEndIndex + styleEndTag.length);

// Extract style block from templates/report_comprehensive.ejs
const compStyleStartIndex = compContent.indexOf(styleStartTag);
const compStyleEndIndex = compContent.indexOf(styleEndTag, compStyleStartIndex);

if (compStyleStartIndex === -1 || compStyleEndIndex === -1) {
  throw new Error("Could not find style tags in report_comprehensive.ejs");
}

// Replace style block in report_comprehensive.ejs
compContent = compContent.substring(0, compStyleStartIndex) + claudeStyle + compContent.substring(compStyleEndIndex + styleEndTag.length);

// Now let's extract the link tags for fonts from claudereport.html
// In claudereport.html, they are between line 14 and 18 (googleapis preconnects and the main fonts link tag)
const linkStartToken = '<link rel="preconnect" href="https://fonts.googleapis.com">';
const linkEndToken = 'rel="stylesheet">';
const fontLinkStartIndex = claudeContent.indexOf(linkStartToken);
const fontLinkEndIndex = claudeContent.indexOf(linkEndToken, fontLinkStartIndex);

if (fontLinkStartIndex !== -1 && fontLinkEndIndex !== -1) {
  const claudeFontLinks = claudeContent.substring(fontLinkStartIndex, fontLinkEndIndex + linkEndToken.length);
  
  // Find where they are in report_comprehensive.ejs and replace them
  const compFontStartIndex = compContent.indexOf(linkStartToken);
  const compFontEndIndex = compContent.indexOf(linkEndToken, compFontStartIndex);
  
  if (compFontStartIndex !== -1 && compFontEndIndex !== -1) {
    compContent = compContent.substring(0, compFontStartIndex) + claudeFontLinks + compContent.substring(compFontEndIndex + linkEndToken.length);
    console.log("Successfully replaced font link tags!");
  } else {
    console.log("Could not find font link tags in report_comprehensive.ejs");
  }
} else {
  console.log("Could not find font link tags in claudereport.html");
}

// Write the updated content back
await fs.writeFile(comprehensivePath, compContent, 'utf-8');
console.log("Successfully merged style block and font tags into templates/report_comprehensive.ejs!");
