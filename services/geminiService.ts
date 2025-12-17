
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractSpecimenData = async (base64Image: string) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this herbarium specimen image. Specifically, focus on the label usually found in the bottom corner.
    Extract the following information if available:
    - Scientific Name (Genus + Species)
    - Family
    - Genus
    - Collector Name
    - Collection Date (extract as precisely as possible: YYYY-MM-DD, YYYY-MM, or just YYYY if that's all that is available)
    - Country (e.g. USA, Canada, Brazil)
    - State or Province (e.g. California, Ontario, Amazonas)
    - County or City (e.g. Los Angeles County, Toronto, Manaus)
    - Locality Description (Specific details about where it was found)
    - Habitat Information (Type of environment, e.g. "shady deciduous forest", "coastal dune")
    - Brief description of the specimen features visible.
  `;

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image,
    },
  };

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scientificName: { type: Type.STRING },
          family: { type: Type.STRING },
          genus: { type: Type.STRING },
          collector: { type: Type.STRING },
          collectionDate: { type: Type.STRING },
          country: { type: Type.STRING },
          stateProvince: { type: Type.STRING },
          countyCity: { type: Type.STRING },
          localityDescription: { type: Type.STRING },
          habitat: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["scientificName", "family", "genus"],
      },
    },
  });

  return JSON.parse(response.text);
};

export const generateSpecimenAnnotation = async (specimenDetails: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `Based on the following specimen data, provide a professional botanical annotation summarizing the specimen's characteristics and its importance for scientific record: ${specimenDetails}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};
