import { Label } from 'cc';

/**
 * 让运行时系统字体 Label 共享 Cocos 的 1024×1024 字符图集。
 *
 * 相邻 Label 会引用同一纹理和材质并进入同一 UI 批次；调用方不得再使用 CHAR
 * 模式不支持的 SHRINK 排版，应预留确定的内容尺寸。
 */
export function useSharedCharacterAtlas(label: Label): void {
  label.useSystemFont = true;
  label.cacheMode = Label.CacheMode.CHAR;
  label.enableWrapText = false;
}
