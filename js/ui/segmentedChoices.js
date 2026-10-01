// Shared registry for every segmented choice control that mirrors a native
// select. One owner for the ".choice-summary" surfaces so startup hydration,
// history controls and locale changes all render the same controls instead of
// each holding a private copy. The controls are built on first render rather
// than at import time, so importing this module never depends on DOM order.

import { createSegmentedChoice } from './SegmentedChoice.js';

let choices = null;

const getChoices = () => {
  if (!choices) {
    choices = [...document.querySelectorAll('.choice-summary')].map((root) => createSegmentedChoice({
      root,
      select: document.getElementById(root.dataset.selectId),
    }));
  }
  return choices;
};

export const renderSegmentedChoices = () => {
  getChoices().forEach((choice) => choice.render());
};