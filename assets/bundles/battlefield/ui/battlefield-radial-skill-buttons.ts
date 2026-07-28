import { Color, EventTouch, Graphics, Layers, Node, UITransform } from 'cc';
import { WeaponSkillCommand } from '../../../core/equipment/equipment';
import {
  type EquipmentHudProfile,
  type WeaponSkillHudProfile,
} from '../equipment/catalog/equipment-hud-profile';
import { drawBattlefieldSkillIcon } from './battlefield-skill-icon-graphics';
import { calculateBattlefieldRadialSkillLayout } from './battlefield-radial-skill-layout';

const BUTTON_RADIUS = 31;
const READY_COLOR = new Color(242, 177, 74, 255);
const CHARGE_COLOR = new Color(112, 196, 220, 245);
const EMPTY_COLOR = new Color(74, 91, 98, 190);
const FILL_COLOR = new Color(45, 53, 55, 225);
const SKILL_BUTTON_INDICES = Object.freeze([0, 1, 2] as const);
type SkillButtonIndex = typeof SKILL_BUTTON_INDICES[number];

/** 世界输入层一次性消费的两路独立技能命令。 */
export interface BattlefieldRadialSkillCommands {
  readonly spinRequested: boolean;
  readonly groundSlamRequested: boolean;
  readonly recallAllRequested: boolean;
  readonly huntingTetherRequested: boolean;
}

interface MutableBattlefieldRadialSkillCommands {
  spinRequested: boolean;
  groundSlamRequested: boolean;
  recallAllRequested: boolean;
  huntingTetherRequested: boolean;
}

/** 由当前装备原型驱动最多三枚池化技能按钮的图标、命令和显隐。 */
export class BattlefieldRadialSkillButtons {
  private readonly buttons: readonly BattlefieldRadialSkillButton[];
  private readonly pending: MutableBattlefieldRadialSkillCommands = createCommands();
  private readonly consumed: MutableBattlefieldRadialSkillCommands = createCommands();
  private profile: Readonly<EquipmentHudProfile> | null = null;
  private layoutCenterX = 0;
  private layoutCenterY = 0;
  private layoutRadius = 1;
  private revision = 1;
  private disposed = false;

  constructor(parent: Node) {
    this.buttons = Object.freeze(SKILL_BUTTON_INDICES.map((index) => (
      new BattlefieldRadialSkillButton(
        parent,
        `BattlefieldSkillButton${index + 1}`,
        this.handleRequested,
        this.invalidate,
      )
    )));
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  public setLayout(centerX: number, centerY: number, orbitRadius: number): void {
    this.layoutCenterX = centerX;
    this.layoutCenterY = centerY;
    this.layoutRadius = orbitRadius;
    this.reflowActiveButtons();
  }

  /** 同一帧按数组顺序替换当前装备技能；空手时立即隐藏并清空输入。 */
  public presentProfile(profile: Readonly<EquipmentHudProfile> | null): void {
    if (this.profile === profile) {
      return;
    }
    this.profile = profile;
    if ((profile?.skills.length ?? 0) > this.buttons.length) {
      throw new Error('装备技能数量超过径向按钮池容量。');
    }
    for (const index of SKILL_BUTTON_INDICES) {
      this.buttons[index]?.configure(profile?.skills[index] ?? null);
    }
    this.reflowActiveButtons();
    if (profile === null) {
      resetCommands(this.pending);
      resetCommands(this.consumed);
    }
    this.invalidate();
  }

  public presentCharge(hitCount: number, requiredHits: number, ready: boolean): void {
    for (const button of this.buttons) {
      button.presentCharge(hitCount, requiredHits, ready);
    }
  }

  public consumeCommands(): Readonly<BattlefieldRadialSkillCommands> {
    const result = this.consumed;
    result.spinRequested = this.pending.spinRequested;
    result.groundSlamRequested = this.pending.groundSlamRequested;
    result.recallAllRequested = this.pending.recallAllRequested;
    result.huntingTetherRequested = this.pending.huntingTetherRequested;
    resetCommands(this.pending);
    return result;
  }

  public setKeyboardActive(index: SkillButtonIndex, active: boolean): void {
    this.buttons[index]?.setKeyboardActive(active);
  }

  public draw(graphics: Graphics): void {
    for (const button of this.buttons) {
      button.draw(graphics);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const button of this.buttons) {
      button.dispose();
    }
    resetCommands(this.pending);
    resetCommands(this.consumed);
  }

  private readonly handleRequested = (command: WeaponSkillCommand): void => {
    switch (command) {
      case WeaponSkillCommand.Spin:
        this.pending.spinRequested = true;
        break;
      case WeaponSkillCommand.GroundSlam:
        this.pending.groundSlamRequested = true;
        break;
      case WeaponSkillCommand.RecallAll:
        this.pending.recallAllRequested = true;
        break;
      case WeaponSkillCommand.HuntingTether:
        this.pending.huntingTetherRequested = true;
        break;
    }
  };

  /** 依据装备技能数组顺序重新计算全部活动按钮的对称圆弧位置。 */
  private reflowActiveButtons(): void {
    const skillCount = this.profile?.skills.length ?? 0;
    const layout = calculateBattlefieldRadialSkillLayout(
      this.layoutCenterX,
      this.layoutCenterY,
      this.layoutRadius,
      skillCount,
    );
    for (let index = 0; index < skillCount; index++) {
      const point = layout[index];
      if (point !== undefined) {
        this.buttons[index]?.setPosition(point.x, point.y);
      }
    }
  }

  private readonly invalidate = (): void => {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  };
}

/** 单枚按钮只管理自身配置、触点占用和按压边沿。 */
class BattlefieldRadialSkillButton {
  private readonly root: Node;
  private profile: Readonly<WeaponSkillHudProfile> | null = null;
  private activeTouchId: number | null = null;
  private keyboardActive = false;
  private hitCount = 0;
  private requiredHits = 5;
  private ready = false;
  private centerX = 0;
  private centerY = 0;
  private disposed = false;

  constructor(
    parent: Node,
    nodeName: string,
    private readonly request: (command: WeaponSkillCommand) => void,
    private readonly invalidate: () => void,
  ) {
    const root = new Node(nodeName);
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    root.addComponent(UITransform).setContentSize(BUTTON_RADIUS * 2.25, BUTTON_RADIUS * 2.25);
    root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    root.active = false;
    this.root = root;
  }

  public configure(profile: Readonly<WeaponSkillHudProfile> | null): void {
    this.profile = profile;
    this.root.active = profile !== null;
    this.activeTouchId = null;
    this.keyboardActive = false;
    this.invalidate();
  }

  public setPosition(x: number, y: number): void {
    if (this.centerX === x && this.centerY === y) {
      return;
    }
    this.centerX = x;
    this.centerY = y;
    this.root.setPosition(x, y);
    this.invalidate();
  }

  public presentCharge(hitCount: number, requiredHits: number, ready: boolean): void {
    if (!Number.isSafeInteger(hitCount) || hitCount < 0
      || !Number.isSafeInteger(requiredHits) || requiredHits <= 0) {
      throw new Error('径向技能键震势进度参数无效。');
    }
    if (this.hitCount === hitCount && this.requiredHits === requiredHits && this.ready === ready) {
      return;
    }
    this.hitCount = hitCount;
    this.requiredHits = requiredHits;
    this.ready = ready;
    this.invalidate();
  }

  public setKeyboardActive(active: boolean): void {
    const profile = this.profile;
    const nextActive = active && profile !== null;
    if (this.keyboardActive === nextActive) {
      return;
    }
    this.keyboardActive = nextActive;
    if (nextActive && profile !== null) {
      this.request(profile.command);
    }
    this.invalidate();
  }

  public draw(graphics: Graphics): void {
    const profile = this.profile;
    if (profile === null) {
      return;
    }
    const pressed = this.activeTouchId !== null || this.keyboardActive;
    graphics.fillColor = FILL_COLOR;
    graphics.strokeColor = this.ready ? READY_COLOR : EMPTY_COLOR;
    graphics.lineWidth = pressed ? 5 : 3;
    graphics.circle(this.centerX, this.centerY, BUTTON_RADIUS);
    graphics.fill();
    graphics.stroke();
    drawBattlefieldSkillIcon(
      graphics,
      profile.icon,
      this.centerX,
      this.centerY,
      this.ready ? READY_COLOR : CHARGE_COLOR,
    );
    const segmentCount = Math.max(1, this.requiredHits);
    for (let segment = 0; segment < segmentCount; segment++) {
      const start = -Math.PI * 0.5 + segment / segmentCount * Math.PI * 2 + 0.05;
      const end = -Math.PI * 0.5 + (segment + 1) / segmentCount * Math.PI * 2 - 0.05;
      graphics.strokeColor = this.ready || segment < this.hitCount ? READY_COLOR : EMPTY_COLOR;
      graphics.lineWidth = 4;
      graphics.arc(this.centerX, this.centerY, BUTTON_RADIUS + 7, start, end, false);
      graphics.stroke();
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.root.isValid) {
      this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
      this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
      this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
      this.root.destroy();
    }
  }

  private readonly handleTouchStart = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.activeTouchId === null && this.profile !== null) {
      this.activeTouchId = id;
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchEnd = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.activeTouchId === id) {
      this.activeTouchId = null;
      if (this.profile !== null) {
        this.request(this.profile.command);
      }
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchCancel = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.activeTouchId === id) {
      this.activeTouchId = null;
      this.invalidate();
    }
    event.propagationStopped = true;
  };
}

function createCommands(): MutableBattlefieldRadialSkillCommands {
  return {
    spinRequested: false,
    groundSlamRequested: false,
    recallAllRequested: false,
    huntingTetherRequested: false,
  };
}

function resetCommands(commands: MutableBattlefieldRadialSkillCommands): void {
  commands.spinRequested = false;
  commands.groundSlamRequested = false;
  commands.recallAllRequested = false;
  commands.huntingTetherRequested = false;
}
