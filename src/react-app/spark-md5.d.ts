declare module 'spark-md5' {
  export default class SparkMD5 {
    static ArrayBuffer: {
      new (): {
        append(arr: ArrayBuffer): void;
        end(): string;
      };
    };
  }
} 