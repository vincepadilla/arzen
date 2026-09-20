// Step-by-step logger for detailed reporting
export const stepLogger = {
  steps: [],
  log(step) {
    this.steps.push(step);
  },
  clear() {
    this.steps = [];
  },
  getSteps() {
    return this.steps;
  }
};
