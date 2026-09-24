import mongoose from "mongoose";
export * from "./models";
export * from "./cloneConfig";
export declare function connectToDatabase(): Promise<typeof mongoose>;
export declare function toPlainDoc(doc: any): any;
export declare const prisma: any;
//# sourceMappingURL=index.d.ts.map