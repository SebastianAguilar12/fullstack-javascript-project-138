class PageLoaderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PageLoaderError';
  }
}

export default PageLoaderError;
