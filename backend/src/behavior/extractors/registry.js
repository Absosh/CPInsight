class FeatureExtractorRegistry {
  constructor() {
    this.extractors = new Map();
  }

  register(extractor) {
    if (this.extractors.has(extractor.id)) throw new Error(`Duplicate extractor: ${extractor.id}`);
    this.extractors.set(extractor.id, extractor);
  }

  all() {
    return [...this.extractors.values()];
  }
}

module.exports = { FeatureExtractorRegistry };
