declare module 'react-native-mmkv' {
  export type MMKV = {
    set: (key: string, value: string | number | boolean) => void;
    getString: (key: string) => string | undefined;
    getNumber: (key: string) => number | undefined;
    getBoolean: (key: string) => boolean | undefined;
    contains: (key: string) => boolean;
    delete: (key: string) => void;
    remove: (key: string) => void;
    getAllKeys: () => string[];
    clearAll: () => void;
    recrypt: (key: string | undefined) => void;
    addOnValueChangedListener: (callback: (key: string) => void) => { remove: () => void };
  };

  export function createMMKV(options?: {
    id?: string;
    encryptionKey?: string;
  }): MMKV;
}
