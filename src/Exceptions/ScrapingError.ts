import ChatExchangeError from "./ChatExchangeError";

/**
 * An error thrown during extracting elements from scraped pages
 */
export class ScrapingError extends ChatExchangeError {
    /**
     * Constructs an instance of ScrapingError
     * @param message error message
     * @param html scraped HTML string
     * @param selector optional selector if attempting to find an element
     */
    constructor(
        message: string,
        public html: string,
        public selector?: string
    ) {
        super(message);
    }
}

export default ScrapingError;
