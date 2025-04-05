import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import dotenv from "dotenv";
import { Entity } from "./types";

dotenv.config({ path: "config.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  storageAccount: process.env.AZURE_STORAGE_ACCOUNT!,
  storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY!,
  db1: "dictengtokon",
  db2: "dictkontoeng",
  siteUrl: "https://www.konkanivocabulary.in",
  cacheFile: path.join(dirname(__dirname), "sitemap-cache.json"),
  cacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// Create Azure Table client
const credential = new AzureNamedKeyCredential(
  config.storageAccount,
  config.storageAccessKey
);

interface SitemapCache {
  timestamp: number;
  englishWords: string[];
  konkaniWords: string[];
}

/**
 * Generates a sitemap XML file
 * Uses cached data if available and not expired
 */
async function generateSitemap(): Promise<void> {
  console.log("Starting sitemap generation process...");

  let englishWords: string[] = [];
  let konkaniWords: string[] = [];
  let useCache = false;

  // Check if cache exists and is valid
  if (fs.existsSync(config.cacheFile)) {
    try {
      const cacheData = JSON.parse(
        fs.readFileSync(config.cacheFile, "utf8")
      ) as SitemapCache;
      const cacheAge = Date.now() - cacheData.timestamp;

      if (cacheAge < config.cacheDuration) {
        console.log(
          `Using cached sitemap data (${Math.round(
            cacheAge / (24 * 60 * 60 * 1000)
          )} days old)`
        );
        englishWords = cacheData.englishWords;
        konkaniWords = cacheData.konkaniWords;
        useCache = true;
      } else {
        console.log(
          `Cache expired (${Math.round(
            cacheAge / (24 * 60 * 60 * 1000)
          )} days old)`
        );
      }
    } catch (error) {
      console.error("Error reading cache file:", error);
    }
  }

  // If cache isn't valid, fetch from Azure Tables
  if (!useCache) {
    console.log("Fetching words from Azure Tables...");
    try {
      // Create table clients for both dictionaries
      const englishToKonkaniClient = new TableClient(
        `https://${config.storageAccount}.table.core.windows.net`,
        config.db1,
        credential
      );

      const konkaniToEnglishClient = new TableClient(
        `https://${config.storageAccount}.table.core.windows.net`,
        config.db2,
        credential
      );

      // Get unique English words
      const englishEntities = englishToKonkaniClient.listEntities<Entity>({
        queryOptions: { select: ["english_word"] },
      });

      // Process English words
      const processedEnglishWords = new Set<string>();
      for await (const entity of englishEntities) {
        if (
          entity.english_word &&
          !processedEnglishWords.has(entity.english_word)
        ) {
          processedEnglishWords.add(entity.english_word);
        }
      }
      englishWords = Array.from(processedEnglishWords);
      console.log(`Fetched ${englishWords.length} unique English words`);

      // Get unique Konkani words
      const konkaniEntities = konkaniToEnglishClient.listEntities<Entity>({
        queryOptions: { select: ["konkani_word"] },
      });

      // Process Konkani words
      const processedKonkaniWords = new Set<string>();
      for await (const entity of konkaniEntities) {
        if (
          entity.konkani_word &&
          !processedKonkaniWords.has(entity.konkani_word)
        ) {
          processedKonkaniWords.add(entity.konkani_word);
        }
      }
      konkaniWords = Array.from(processedKonkaniWords);
      console.log(`Fetched ${konkaniWords.length} unique Konkani words`);

      // Save to cache
      const cacheData: SitemapCache = {
        timestamp: Date.now(),
        englishWords,
        konkaniWords,
      };

      fs.writeFileSync(config.cacheFile, JSON.stringify(cacheData, null, 2));
      console.log("Cached sitemap data saved");
    } catch (error) {
      console.error("Error fetching words from Azure Tables:", error);
      throw error;
    }
  }

  // Generate sitemap XML
  console.log("Generating sitemap XML...");

  // Start with static pages
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${config.siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${config.siteUrl}/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${config.siteUrl}/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${config.siteUrl}/suggest</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${config.siteUrl}/contents</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${config.siteUrl}/discover</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

  // Add English words
  for (const word of englishWords) {
    // Trim any leading/trailing spaces or plus signs, then replace spaces with plus signs
    const trimmedWord = word.trim().replace(/^[+]+|[+]+$/g, "");
    const encodedWord = trimmedWord.replace(/ /g, "+");
    sitemap += `
  <url>
    <loc>${config.siteUrl}/words/${encodedWord}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  // Add Konkani words
  for (const word of konkaniWords) {
    // Trim any leading/trailing spaces or plus signs, then replace spaces with plus signs
    const trimmedWord = word.trim().replace(/^[+]+|[+]+$/g, "");
    const encodedWord = trimmedWord.replace(/ /g, "+");
    sitemap += `
  <url>
    <loc>${config.siteUrl}/words/${encodedWord}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  // Close sitemap
  sitemap += `
</urlset>`;

  // Write sitemap to file
  const publicDir = path.join(dirname(__dirname), "dist", "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap);
  console.log(
    `Sitemap generated with ${englishWords.length} English words and ${konkaniWords.length} Konkani words`
  );
}

/**
 * Check if sitemap needs regeneration
 * Returns true if sitemap doesn't exist or cache is expired
 */
function shouldRegenerateSitemap(): boolean {
  const sitemapPath = path.join(
    dirname(__dirname),
    "dist",
    "public",
    "sitemap.xml"
  );

  // If sitemap doesn't exist, regenerate
  if (!fs.existsSync(sitemapPath)) {
    return true;
  }

  // If cache doesn't exist, regenerate
  if (!fs.existsSync(config.cacheFile)) {
    return true;
  }

  try {
    // Check cache age
    const cacheData = JSON.parse(
      fs.readFileSync(config.cacheFile, "utf8")
    ) as SitemapCache;
    const cacheAge = Date.now() - cacheData.timestamp;

    // Regenerate if cache expired
    return cacheAge >= config.cacheDuration;
  } catch (error) {
    console.error("Error checking cache:", error);
    return true;
  }
}

// Run the generator if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateSitemap().catch(console.error);
}

export { generateSitemap, shouldRegenerateSitemap };
