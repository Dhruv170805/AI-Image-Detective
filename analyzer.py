import sys
import os
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image
import warnings

# Ignore warnings to keep the output clean for Node.js
warnings.filterwarnings("ignore")

try:
    image_path = sys.argv[1]

    # 1. UPGRADE THE AI: We are swapping "base" for "large"
    # This model is smarter and has a much richer vocabulary
    model_name = "Salesforce/blip-image-captioning-large"
    
    processor = BlipProcessor.from_pretrained(model_name)
    model = BlipForConditionalGeneration.from_pretrained(model_name)

    raw_image = Image.open(image_path).convert('RGB')

    # Give it an even stronger push to be descriptive
    starting_text = "a highly detailed, vivid, and complex description of this scene shows "
    inputs = processor(raw_image, text=starting_text, return_tensors="pt")

    # 2. BRUTE-FORCE THE LENGTH
    out = model.generate(
        **inputs,
        max_new_tokens=150,      # Maximum words allowed
        min_new_tokens=40,       # THE FIX: It is forbidden to write fewer than 40 new words!
        num_beams=5,             # Think 5x harder about the sentence structure
        repetition_penalty=1.5,  # Strictly forbid it from repeating the same words
        length_penalty=2.0       # Mathematically reward it for rambling and adding details
    )
    
    description = processor.decode(out[0], skip_special_tokens=True)
    final_description = description.replace(starting_text, "").strip()

    # Print the long description!
    print(final_description.capitalize())

    os._exit(0)

except Exception as e:
    print(f"Error analyzing image: {str(e)}", file=sys.stderr)
    os._exit(1)