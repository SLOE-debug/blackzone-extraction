import { Color, EventTouch, Graphics, Layers, Node, UITransform } from 'cc';

const BUTTON_RADIUS = 31;
const READY_COLOR = new Color(242, 177, 74, 255);
const CHARGE_COLOR = new Color(112, 196, 220, 245);
const EMPTY_COLOR = new Color(74, 91, 98, 190);
const FILL_COLOR = new Color(45, 53, 55, 225);

/** 三枚径向技能键的固定角度与领域身份。 */
export enum BattlefieldRadialSkill {
  Spin,
  GroundSlam,
  Uppercut,
}

/** 世界输入层一次性消费的三路独立技能命令。 */
export interface BattlefieldRadialSkillCommands {
  readonly spinRequested: boolean;
  readonly groundSlamRequested: boolean;
  readonly uppercutRequested: boolean;
}

interface MutableBattlefieldRadialSkillCommands {
  spinRequested: boolean;
  groundSlamRequested: boolean;
  uppercutRequested: boolean;
}

/** 统一编排 0°、45°、90° 三枚独立 Node 与独立 Touch ID。 */
export class BattlefieldRadialSkillButtons {
  private readonly buttons: Readonly<Record<BattlefieldRadialSkill, BattlefieldRadialSkillButton>>;
  private readonly pending: MutableBattlefieldRadialSkillCommands = createCommands();
  private readonly consumed: MutableBattlefieldRadialSkillCommands = createCommands();
  private revision = 1;
  private disposed = false;

  constructor(parent: Node) {
    this.buttons = Object.freeze({
      [BattlefieldRadialSkill.Spin]: new BattlefieldRadialSkillButton(
        parent,
        BattlefieldRadialSkill.Spin,
        'BattlefieldSpinSkillButton',
        this.handleRequested,
        this.invalidate,
      ),
      [BattlefieldRadialSkill.GroundSlam]: new BattlefieldRadialSkillButton(
        parent,
        BattlefieldRadialSkill.GroundSlam,
        'BattlefieldGroundSlamSkillButton',
        this.handleRequested,
        this.invalidate,
      ),
      [BattlefieldRadialSkill.Uppercut]: new BattlefieldRadialSkillButton(
        parent,
        BattlefieldRadialSkill.Uppercut,
        'BattlefieldUppercutSkillButton',
        this.handleRequested,
        this.invalidate,
      ),
    });
  }

  public get graphicsRevision(): number {
    return this.revision;
  }

  /** 以右摇杆中心为原点，把技能键放在半径固定的三条射线上。 */
  public setLayout(centerX: number, centerY: number, orbitRadius: number): void {
    if (![centerX, centerY, orbitRadius].every(Number.isFinite) || orbitRadius <= 0) {
      throw new Error('径向技能键布局必须使用有限中心和正轨道半径。');
    }
    const diagonal = orbitRadius * Math.SQRT1_2;
    this.buttons[BattlefieldRadialSkill.Spin].setPosition(
      centerX + orbitRadius,
      centerY,
    );
    this.buttons[BattlefieldRadialSkill.GroundSlam].setPosition(
      centerX + diagonal,
      centerY + diagonal,
    );
    this.buttons[BattlefieldRadialSkill.Uppercut].setPosition(
      centerX,
      centerY + orbitRadius,
    );
  }

  /** 三种技能共享震势资源，但保持各自独立的视觉与点击区域。 */
  public presentCharge(hitCount: number, requiredHits: number, ready: boolean): void {
    for (const skill of RADIAL_SKILLS) {
      this.buttons[skill].presentCharge(hitCount, requiredHits, ready);
    }
  }

  /** 把当前三路请求复制到稳定快照后分别清空。 */
  public consumeCommands(): Readonly<BattlefieldRadialSkillCommands> {
    const result = this.consumed;
    result.spinRequested = this.pending.spinRequested;
    result.groundSlamRequested = this.pending.groundSlamRequested;
    result.uppercutRequested = this.pending.uppercutRequested;
    resetCommands(this.pending);
    return result;
  }

  public setKeyboardActive(skill: BattlefieldRadialSkill, active: boolean): void {
    this.buttons[skill].setKeyboardActive(active);
  }

  public draw(graphics: Graphics): void {
    for (const skill of RADIAL_SKILLS) {
      this.buttons[skill].draw(graphics);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const skill of RADIAL_SKILLS) {
      this.buttons[skill].dispose();
    }
    resetCommands(this.pending);
    resetCommands(this.consumed);
  }

  private readonly handleRequested = (skill: BattlefieldRadialSkill): void => {
    switch (skill) {
      case BattlefieldRadialSkill.Spin:
        this.pending.spinRequested = true;
        break;
      case BattlefieldRadialSkill.GroundSlam:
        this.pending.groundSlamRequested = true;
        break;
      case BattlefieldRadialSkill.Uppercut:
        this.pending.uppercutRequested = true;
        break;
    }
  };

  private readonly invalidate = (): void => {
    this.revision = this.revision >= Number.MAX_SAFE_INTEGER ? 1 : this.revision + 1;
  };
}

/** 单枚按钮只管理自己的触点占用和按压边沿。 */
class BattlefieldRadialSkillButton {
  private readonly root: Node;
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
    private readonly skill: BattlefieldRadialSkill,
    nodeName: string,
    private readonly request: (skill: BattlefieldRadialSkill) => void,
    private readonly invalidate: () => void,
  ) {
    const root = new Node(nodeName);
    root.layer = Layers.Enum.UI_2D;
    parent.addChild(root);
    root.addComponent(UITransform).setContentSize(BUTTON_RADIUS * 2.25, BUTTON_RADIUS * 2.25);
    root.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    root.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    root.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
    this.root = root;
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
    if (this.keyboardActive === active) {
      return;
    }
    this.keyboardActive = active;
    if (active) {
      this.request(this.skill);
    }
    this.invalidate();
  }

  public draw(graphics: Graphics): void {
    const pressed = this.activeTouchId !== null || this.keyboardActive;
    graphics.fillColor = FILL_COLOR;
    graphics.strokeColor = this.ready ? READY_COLOR : EMPTY_COLOR;
    graphics.lineWidth = pressed ? 5 : 3;
    graphics.circle(this.centerX, this.centerY, BUTTON_RADIUS);
    graphics.fill();
    graphics.stroke();
    drawSkillIcon(
      graphics,
      this.skill,
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
    this.activeTouchId = null;
    if (this.root.isValid) {
      this.root.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
      this.root.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
      this.root.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
      this.root.destroy();
    }
  }

  private readonly handleTouchStart = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.activeTouchId === null) {
      this.activeTouchId = id;
      this.invalidate();
    }
    event.propagationStopped = true;
  };

  private readonly handleTouchEnd = (event: EventTouch): void => {
    const id = event.getID();
    if (id !== null && this.activeTouchId === id) {
      this.activeTouchId = null;
      this.request(this.skill);
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

const RADIAL_SKILLS = Object.freeze([
  BattlefieldRadialSkill.Spin,
  BattlefieldRadialSkill.GroundSlam,
  BattlefieldRadialSkill.Uppercut,
]);

function createCommands(): MutableBattlefieldRadialSkillCommands {
  return {
    spinRequested: false,
    groundSlamRequested: false,
    uppercutRequested: false,
  };
}

function resetCommands(commands: MutableBattlefieldRadialSkillCommands): void {
  commands.spinRequested = false;
  commands.groundSlamRequested = false;
  commands.uppercutRequested = false;
}

function drawSkillIcon(
  graphics: Graphics,
  skill: BattlefieldRadialSkill,
  x: number,
  y: number,
  color: Readonly<Color>,
): void {
  graphics.strokeColor = color;
  graphics.fillColor = color;
  graphics.lineWidth = 4;
  switch (skill) {
    case BattlefieldRadialSkill.Spin:
      graphics.arc(x, y, 13, -Math.PI * 0.15, Math.PI * 1.45, false);
      graphics.stroke();
      graphics.moveTo(x - 12, y - 9);
      graphics.lineTo(x - 17, y - 1);
      graphics.lineTo(x - 7, y - 2);
      graphics.close();
      graphics.fill();
      break;
    case BattlefieldRadialSkill.GroundSlam:
      graphics.moveTo(x, y + 14);
      graphics.lineTo(x, y - 5);
      graphics.stroke();
      graphics.moveTo(x - 8, y + 5);
      graphics.lineTo(x, y - 5);
      graphics.lineTo(x + 8, y + 5);
      graphics.stroke();
      graphics.moveTo(x - 16, y - 12);
      graphics.lineTo(x - 6, y - 8);
      graphics.lineTo(x, y - 14);
      graphics.lineTo(x + 7, y - 8);
      graphics.lineTo(x + 16, y - 12);
      graphics.stroke();
      break;
    case BattlefieldRadialSkill.Uppercut:
      graphics.moveTo(x, y - 14);
      graphics.lineTo(x, y + 12);
      graphics.stroke();
      graphics.moveTo(x - 9, y + 3);
      graphics.lineTo(x, y + 12);
      graphics.lineTo(x + 9, y + 3);
      graphics.stroke();
      break;
  }
}
