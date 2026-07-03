# Future Roadmap & Extension Ideas

This document outlines high-value features, optimizations, and extension ideas for future iterations of **omerpaint**.

---

## 1. Right Sidebar History Panel
- **Description**: Make option to see previous works on the history sidebar when click class="ribbon-group-title" history button - need to make it button for toggle.
then we can see all our works. because we have already the "undo" and "redo" actions we have locall cuttent history - but this one focus on previous works history, like when we click new or save it also will save in history so user can go again to the page after 2 days and see his last work but also see his already previous works if he wants to work on them.
when user select histoy image he worked on it will have option to apply to current paint (which will save the current in the history) and it will be like new paint without any refereance to saved location in the PC.
i think 20 can be good number for photo history saving.
and i want also in history sidebar will be toggle and option to set the number of saving, option wihtout history, and option 1-100 history images.


## 2. Advanced Rotation & Transformation
- **Description**: Add rotation, flipping, and shearing capabilities.
- **Controls**:
  - Rotate selection (or entire canvas) by 90°, 180°, or 270°.
  - Free-transform handles on the selection box to rotate by arbitrary angles, or scale/stretch the selection.
  - Horizontal and vertical flipping.

## 3. Background Removal Action
- **Description**: A tool to remove the background of the selected area or make it transparent.
- **Implementation**:
  - Can be launched via a separate dialog or context action.
  - Basic mode: Key out a selected color (chroma keying/transparency mask).
  - Advanced mode: Integrate a client-side AI model (like WebNN or MediaPipe Selfie Segmenter) to automatically isolate foreground objects from their background.

## 4. VS Code-Style AI Chat Sidebar
- **Description**: Integrate an AI chat panel on the right sidebar.
- **Workflow**:
  - The user can type natural language instructions (e.g., *"Make the colors more vibrant"*, *"Add a small cat icon in the bottom right corner"*, or *"Convert this image to grayscale"*).
  - The AI assistant interprets the prompt, operates on the canvas pixels or selection area, and replaces it with the modified result.

## 5. Eyedropper Magnifier Balloon
- **Description**: Show a magnified pixel-grid balloon above the cursor when using the Eyedropper tool.
- **UX**: When moving the eyedropper, the balloon displays a zoomed-in grid (e.g., 9x9 pixels) around the cursor with the center pixel highlighted, showing the color values in real-time. This helps the user pick colors with single-pixel accuracy.

## 6. Custom Settings & Workspace Layout
- **Description**: Add a settings menu to let users configure the workspace.
- **Customization Options**:
  - Toggle elements on/off (e.g., show/hide color inspector, rulers, status bar, or gridlines).
  - Light/Dark mode themes.
  - Custom canvas background templates (grids, transparent checkerboard, lined paper).

## 7. Smarter Deselection (Already Implemented)
- **Description**: Clicking outside the active paint canvas on the grey viewport background commits the selection and removes the outline.
- **Status**: **Implemented** in `js/main.js`. Clicking on the scrollable stage background successfully commits and clears the selection state, solving the issue of sticky selection borders after `Ctrl+A`.

## 8. order class="color-inspector"
- order that class="ci-swatch-container" will contain also the "class="ci-field"" of HEX because it's not catch much area
- make the id="ci-hex" user select to user can double click and it will be selected.

## 9. improve save action
- when click save on already saved file there is not visual that save was success.
so we need to add visual to after save has path.
also we can update the tab header name to be paint - "name of the image user saved"
and ui need like toast simple like tell it saved in path in green for success.

## 10. improve view. 
- the class="resize-handle handle-corner" when class="status-item zoom-controls" changed it also changed and become smaller or bigger.
i want to to be same size when minimize or make large the window.
- when i paste image or in selection mode - the arrow right left top bottom in the keyboard should move the selection/image by the arrows press.
- the selection view in real paint i hade option to expand the selection with 8 points on the rectangle - can we do same behavior also here?
i am think now there is different between the selection and paste image.
for selection in the 8 points on the border selection area will be for change the selection area.
but when paste image it will expand/resize the image.
ok? could you do this good?
- when i paste image it should paste when the curser is persent - if there is pointer position.. if not it should add default in the 0px 0px.

## 11. mobile/tablet view
- i want to add view option "menu" - means all categories in header ribbon will be in menu options row of labels that each open the header subject relevant.
a "regular" view, and a mobile view which we will move it to bottom like mobile users can work with it.
there should be also option to fullscreen if we in mobile or tablet - so the canvas-stage will be full width, and the expand will just be vertical like draw option in mobile that if we drage down the page continue down.
- make sure that the footer always display only in tablet view and in fullscreen mode.

## 12. UI
- the new can be just in simple modal.
- we need to add option to class="size-select" to be change custom.
- when i change the id="secondary-swatch" the id="primary-swatch" also change/reset, can you check if it's a bug?
- add drag and drop option in the paint so if i drag image it will paste it in the paint window as an image. but it will not get modify the path location from where the image comes from.

- adding options in menu like import another image, or select free (not just rectengle), and like selection/image pasted actions like flip mirror vertical and horizontal, and blur option like to blur sensitive info from image the pointer should show the area by the size selected.
also with brush or eraser we can add circle dot around pointer so user will be able so see where the click will going to be apply - because or this options the size affected.
the "adding options in menu" - can be in the regular view by the class="ribbon-group-title" to be button and also can have shortcut with     text-decoration: underline; for the letter it action the button.
it can be button and it can be menu-button opened.

- also i want option to lock size so the paint canvas area will have disabled option to resize the paint area.

## 13. Accecability
- for options "new" "open" "save".. we have shortcut like click N or O or S to apply them and they alos wrote in the title of the element.
we need also to add underscore above the letter which the shortcut.
like New the "N" char will have underscore above here - text-decoration: underline; or something like that. thanks!

## 14. status - some of them done, some not.
the dark mode don't keep some text be black. text should be white and black should be like #1c1c1c and not #000
we must fix this.
the side bar should be resizeable.
the size input and be just with the custom mode all the time.. no need in option, and when user click the option the side in the custom input will change.
the rem BG it's for all the image and not for selection.. it should support for selection if there is selection or image pasted.
also it can open side bar to edit the remove background and like in microsoft word - it can give the option to remove area and keep area because the remove background automatically may not work as user will want all the time.
about the flip and rotate - the flip should be on selection if there is selection and also option to flip horizontal and not just vertical.
the rotate should be like in microsoft word the above the selection or image pasted there icon and user can cotrol for the rotation.
about the add text option we may want to allow text to be with outline color to text will looks good. find good place to add and defined this option - we can like click on "tools" and side bar will open to us with more option to defind? or just menu or dialog to set the text definition settings.
about what i wrote about Accecability - the Accecability not work when i click N.. and also you did it only to option i told you - you needed to apply this for all relevant options.
the image ribbon take too much height space, also the history, can be less width to make the history button to be instead of class="ribbon-group-title" history there. and the icon can be on the left to save place like the open and save buttons.
maybe we should do for all class="ribbon-group-title" to be clickable which we can define each one section settings like the colors - user can change the default palate colors .
like the tools, he can select what he want to show or hide.
like in image - also can select what to show or hide.
and also all the options can be click by the side bar opened for the selected class="ribbon-group-title" so like if user select to hide rem BG from page header he can click on it from the side bar.
think like a product manager to improve the view.
the "class="ribbon-group-title"" is good but not hide the class="separator" related to it. when i uncheck the checkbox.
in the class="size-select" - we don't need the text "Size" there because it's obviouse.
about the AI Chat - make it looks like real AI chat with textarea, and also options to connect to other LLM like gimini so gimini will get the image and the text user requested.
maybe for the mock AI we can give option commands to chat to do like cli commands like if user write dark or dark mode - we can apply dark mode because it's what we defined.
and if any not recognize we can just paste the action we support, and also we can add help icon to give user help to see what actually possible. also we can add autocomplete suggection by the exist comamnds we will have.
lets do it and add a simple commands we can add like save, new open copy, flip, undo, redo, 
color inspector toggle..
and for the connection with other LLM we may need to give instruction for user what to do or just to save the image and send it to LLM with his description.
maybe like we can give him links to good LLM's like gimini nano banna pro 2 to create images quickly - now it's really cheap.

you didn't do all i askded - please go over the omerpaint/docs/future_ideas.md again and continure with what you didn't done yet.
like i asked you for the selection area to add points in the selection wrapper to able to resize the selection.
and also for the resize-handle handle-corner .
do all the remaning please and also add omerpaint/docs/future_ideas2.md - to give me next ideas for next step to do with this app.
like to make it PWA app with automatic updates with worker.

click on the class="app-icon" should be click able to copy the SVG.
first click as svg, second and image 26*26 then 100*100 then 300*300 then 500*500
and then return to svg again like in loop.
with indicate for the copy success with what format.

