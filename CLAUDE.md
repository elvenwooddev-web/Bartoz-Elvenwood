# Elvenwood Interiors Website — Project Memory

## Named Actions

### "Add Project"
When the user says **"Add Project"**, follow this workflow:

1. **Ask the user for these details:**
   - Image file (path or filename in `images/` folder)
   - Client name (e.g., "Mr. Sreenivas Reddy Home")
   - Project type (e.g., Kitchen, Wardrobe, TV Unit, Full Home, Bedroom)
   - Location (e.g., "SVS's Silver Oaks, Heelalige")
   - Timeline (e.g., "45 days")
   - Budget (e.g., "₹12L")

2. **If the image is large (>500KB), resize it** using:
   ```
   dwebp INPUT.webp -o /tmp/temp.png && sips --resampleWidth 1920 /tmp/temp.png --out /tmp/temp.png && cwebp -q 80 /tmp/temp.png -o images/FILENAME.webp
   ```

3. **Insert this HTML** before the `<!-- More projects to be added -->` comment in `work.html`:
   ```html
   <div class="project-grid-card project-grid-card--large" data-type="TYPE" data-cursor="view">
       <div class="project-grid-image image-door-frame">
           <img src="images/IMAGE.webp" alt="DESCRIPTION" loading="lazy">
       </div>
       <div class="project-grid-info">
           <div class="project-grid-meta">
               <span class="project-grid-type">TYPE_LABEL</span>
               <span class="project-grid-location">LOCATION</span>
           </div>
           <h3 class="project-grid-name">CLIENT_NAME</h3>
           <div class="project-grid-details">
               <span>TIMELINE</span>
               <span>BUDGET</span>
           </div>
       </div>
   </div>
   ```

4. **Verify** by reloading the preview and taking a screenshot.

## Project Facts
- Factory size: 17,400 sq ft (not 12,000)
- WhatsApp number: +91 7483226449
- WhatsApp prefilled message: "Hi Elvenwood! 👋 I'm interested in a consultation for my home interiors. Could we schedule a time to discuss my project?"
- Google Maps: https://maps.app.goo.gl/wQ54EVWc7VLsgLZs9
- Location: Experience Centre, Bommasandra Industrial Area, Bangalore
