import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please configure it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Skin Analysis API Endpoint using Gemini
  app.post("/api/analyze-skin", async (req, res) => {
    try {
      const {
        age,
        gender,
        skinType,
        intolerantSubstances = [],
        metrics = {},
        detectedCondition = "Mild Acne",
        confidence = 0.85,
        image // Base64 encoded image string (optional, for visual analysis)
      } = req.body;

      let ai;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        return res.status(400).json({
          error: "API_KEY_MISSING",
          message: err.message || "Gemini API Key is missing. Please add it to Settings > Secrets."
        });
      }

      // Prepare system prompt for Gemini
      const systemInstruction = `You are "Aura Dermix AI", an expert skin-health consultant. Your task is to provide personalized, non-medical recommendations based on a user's on-device skin-scan results, their profile context (age, gender, skin type, and intolerant substances), and an optional scanned image.
      
      CRITICAL INSTRUCTIONS:
      1. You MUST NOT make formal medical diagnoses or prescribe medical prescription drugs.
      2. Refine recommendations carefully using the user's "intolerantSubstances" and "skinType" (e.g. do not recommend heavy oils for Oily skin, or Salicylic acid/retinoids if they are intolerant, or if they have Sensitive skin).
      3. Your advice must be strictly non-medical, focusing on over-the-counter ingredients, general skin wellness, dynamic skincare routine changes, and lifestyle habits.
      4. ALWAYS include a clear disclaimer stating this is AI-driven, non-medical advice and they should seek professional dermatological guidance for chronic issues.`;

      const prompt = `Please analyze this user's skin-health scan:
      - Detected Condition (from on-device classifier): "${detectedCondition}" with confidence: ${Math.round(confidence * 100)}%
      - User Profile: Age: ${age}, Gender: ${gender}, Skin Type: ${skinType}
      - Intolerant / Allergen Substances: ${Array.isArray(intolerantSubstances) ? intolerantSubstances.join(", ") : intolerantSubstances || "None"}
      - On-Device Extracted Pixel Metrics: 
        * Hydration Level: ${metrics.hydration || 40}%
        * Redness/Inflammation Index: ${metrics.redness || 30}%
        * Spot/Blemish Count: ${metrics.spots || 5} detected
        * Pore Visibility Index: ${metrics.pores || 25}%
        
      Based on this data, provide structured skincare advice. Please output strictly JSON conforming to the schema.`;

      const contents: any[] = [prompt];

      // Add image to contents if provided
      if (image && typeof image === "string" && image.includes(",")) {
        const parts = image.split(",");
        const mimeTypeMatch = parts[0].match(/:(.*?);/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
        const base64Data = parts[1];
        
        contents.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysisSummary: {
                type: Type.STRING,
                description: "A professional, personalized clinical-style summary of the skin state, accounting for skin type, age, and scanned condition."
              },
              severityLevel: {
                type: Type.STRING,
                description: "Estimated general severity level: 'Mild', 'Moderate', or 'Complex'."
              },
              nonMedicalRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A list of actionable physical self-care recommendations."
              },
              recommendedSkincareRoutine: {
                type: Type.OBJECT,
                properties: {
                  morning: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Step-by-step morning skincare routine."
                  },
                  evening: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Step-by-step evening skincare routine."
                  }
                },
                required: ["morning", "evening"]
              },
              ingredientsToSeek: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Recommended active ingredients or products (e.g., Niacinamide, Hyaluronic Acid, Centella Asiatica)."
              },
              ingredientsToAvoid: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Ingredients the user must avoid, tailored specifically to their skin type and intolerant substances list."
              },
              lifestyleAdvice: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Actionable diet, sleep, or stress management tips for this condition."
              },
              disclaimer: {
                type: Type.STRING,
                description: "A mandatory friendly medical disclaimer stating that Aura Dermix is an AI skin-health companion and does not replace medical advice."
              }
            },
            required: [
              "analysisSummary",
              "severityLevel",
              "nonMedicalRecommendations",
              "recommendedSkincareRoutine",
              "ingredientsToSeek",
              "ingredientsToAvoid",
              "lifestyleAdvice",
              "disclaimer"
            ]
          }
        }
      });

      const responseText = response.text || "{}";
      const resultData = JSON.parse(responseText.trim());
      res.json(resultData);
    } catch (error: any) {
      console.error("Gemini skin analysis failed:", error);
      res.status(500).json({
        error: "ANALYSIS_FAILED",
        message: error.message || "An error occurred during skin analysis."
      });
    }
  });

  // Vite Integration for Serving UI
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite development middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static production assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Aura Dermix Server] Running at http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
