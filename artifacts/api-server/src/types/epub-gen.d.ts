declare module 'epub-gen' {
  interface EpubChapter {
    title: string;
    data: string;
    author?: string;
  }
  interface EpubOptions {
    title: string;
    author?: string;
    cover?: string;
    content: EpubChapter[];
  }
  class Epub {
    constructor(options: EpubOptions, output: string);
    promise: Promise<void>;
  }
  export = Epub;
}
