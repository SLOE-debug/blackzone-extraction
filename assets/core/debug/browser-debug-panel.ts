import { DEV } from 'cc/env';

/** 浏览器调试面板的稳定外观参数。 */
export interface BrowserDebugPanelOptions {
  readonly id: string;
  readonly title: string;
  readonly accentColor: string;
  readonly outputColor: string;
  readonly width: number;
}

/** 为不同场景提供可折叠的浏览器原生调试控件容器。 */
export class BrowserDebugPanel {
  private readonly root: HTMLElement | null;
  private readonly body: HTMLDivElement | null;

  constructor(private readonly options: Readonly<BrowserDebugPanelOptions>) {
    validateOptions(options);
    if (!DEV || typeof document === 'undefined') {
      this.root = null;
      this.body = null;
      return;
    }

    document.getElementById(options.id)?.remove();
    const root = document.createElement('section');
    root.id = options.id;
    applyPanelStyle(root, options.width);

    const header = document.createElement('button');
    header.type = 'button';
    applyHeaderStyle(header, options.accentColor);
    root.appendChild(header);

    const body = document.createElement('div');
    body.style.padding = '6px 10px 10px';
    root.appendChild(body);
    updateHeaderText(header, options.title, false);
    header.addEventListener('click', () => {
      body.hidden = !body.hidden;
      updateHeaderText(header, options.title, body.hidden);
    });

    document.body.appendChild(root);
    this.root = root;
    this.body = body;
  }

  /** 添加布尔开关。 */
  public addBoolean(
    label: string,
    initialValue: boolean,
    onChange: (value: boolean) => void,
  ): void {
    const body = this.body;
    if (body === null) {
      return;
    }
    const row = createRow(label);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialValue;
    input.style.width = '18px';
    input.style.height = '18px';
    input.style.accentColor = this.options.accentColor;
    input.addEventListener('change', () => onChange(input.checked));
    row.appendChild(input);
    body.appendChild(row);
  }

  /** 添加一行只承担控件分组语义的标题。 */
  public addSection(title: string): void {
    const body = this.body;
    if (body === null) {
      return;
    }
    if (title.length === 0) {
      throw new Error('调试控件分组标题不能为空。');
    }
    const section = document.createElement('div');
    section.textContent = title;
    Object.assign(section.style, {
      marginTop: '8px',
      paddingTop: '7px',
      color: this.options.outputColor,
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      fontSize: '12px',
      fontWeight: '700',
    });
    body.appendChild(section);
  }

  /** 添加带实时数值显示的滑杆。 */
  public addNumber(
    label: string,
    minimum: number,
    maximum: number,
    step: number,
    initialValue: number,
    onChange: (value: number) => void,
  ): void {
    const body = this.body;
    if (body === null) {
      return;
    }
    validateNumberControl(label, minimum, maximum, step, initialValue);
    const row = createRow(label);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(minimum);
    input.max = String(maximum);
    input.step = String(step);
    input.value = String(initialValue);
    input.style.flex = '1';
    input.style.accentColor = this.options.accentColor;

    const output = document.createElement('output');
    output.textContent = formatNumber(initialValue, step);
    output.style.width = '64px';
    output.style.textAlign = 'right';
    output.style.color = this.options.outputColor;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      output.textContent = formatNumber(value, step);
      onChange(value);
    });

    row.append(input, output);
    body.appendChild(row);
  }

  /** 添加浏览器原生颜色选择器。 */
  public addColor(
    label: string,
    initialValue: string,
    onChange: (value: string) => void,
  ): void {
    const body = this.body;
    if (body === null) {
      return;
    }
    const row = createRow(label);
    const input = document.createElement('input');
    input.type = 'color';
    input.value = initialValue;
    input.style.width = '82px';
    input.style.height = '22px';
    input.style.padding = '0';
    input.style.border = '1px solid #555';
    input.style.background = 'transparent';
    input.addEventListener('input', () => onChange(input.value));
    row.appendChild(input);
    body.appendChild(row);
  }

  /** 添加一个立即触发调试动作的按钮。 */
  public addButton(label: string, onClick: () => void): void {
    const body = this.body;
    if (body === null) {
      return;
    }
    if (label.length === 0) {
      throw new Error('调试按钮标签不能为空。');
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      width: '100%',
      minHeight: '30px',
      marginTop: '6px',
      color: '#fff',
      background: this.options.accentColor,
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '3px',
      cursor: 'pointer',
      fontWeight: '700',
    });
    button.addEventListener('click', onClick);
    body.appendChild(button);
  }

  /** 从浏览器页面移除面板。 */
  public dispose(): void {
    this.root?.remove();
  }
}

function createRow(label: string): HTMLLabelElement {
  const row = document.createElement('label');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';
  row.style.minHeight = '28px';
  row.style.fontSize = '12px';

  const text = document.createElement('span');
  text.textContent = label;
  text.style.width = '88px';
  text.style.flex = '0 0 auto';
  text.style.color = '#e8e8e8';
  row.appendChild(text);
  return row;
}

function applyPanelStyle(root: HTMLElement, width: number): void {
  Object.assign(root.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '2147483647',
    width: `${width}px`,
    color: '#fff',
    background: 'rgba(22, 22, 24, 0.94)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    borderRadius: '4px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.42)',
    fontFamily: 'Arial, Microsoft YaHei, sans-serif',
    userSelect: 'none',
  });
}

function applyHeaderStyle(header: HTMLButtonElement, accentColor: string): void {
  Object.assign(header.style, {
    width: '100%',
    padding: '8px 10px',
    color: '#fff',
    background: accentColor,
    border: '0',
    borderRadius: '3px 3px 0 0',
    textAlign: 'left',
    fontWeight: '700',
    cursor: 'pointer',
  });
}

function updateHeaderText(
  header: HTMLButtonElement,
  title: string,
  collapsed: boolean,
): void {
  header.textContent = `${title} ${collapsed ? '＋' : '－'}`;
}

function formatNumber(value: number, step: number): string {
  return step < 1 ? value.toFixed(2) : String(Math.round(value));
}

function validateOptions(options: Readonly<BrowserDebugPanelOptions>): void {
  if (options.id.length === 0 || options.title.length === 0) {
    throw new Error('浏览器调试面板标识和标题不能为空。');
  }
  if (!Number.isFinite(options.width) || options.width <= 0) {
    throw new Error('浏览器调试面板宽度必须是有限正数。');
  }
}

function validateNumberControl(
  label: string,
  minimum: number,
  maximum: number,
  step: number,
  initialValue: number,
): void {
  if (label.length === 0) {
    throw new Error('调试数值控件标签不能为空。');
  }
  if (![minimum, maximum, step, initialValue].every(Number.isFinite)
    || maximum < minimum
    || step <= 0
    || initialValue < minimum
    || initialValue > maximum) {
    throw new Error(`调试数值控件范围无效：${label}`);
  }
}
