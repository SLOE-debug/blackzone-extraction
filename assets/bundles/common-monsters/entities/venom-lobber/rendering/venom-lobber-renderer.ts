import { type Camera, Color, Node } from 'cc';
import { UnlitMaterialFactory } from '../../../../../core/rendering/unlit-material-factory';
import { type VenomLobberCombatOptions } from '../model/venom-lobber-combat-options';
import { type VenomLobberState } from '../model/venom-lobber-state';
import { type VenomBombSystem } from '../behavior/venom-bomb-system';
import { VenomLobberBodyRenderer } from './venom-lobber-body-renderer';
import { VenomLobberEffectRenderer } from './venom-lobber-effect-renderer';

/** 管理 Venom Lobber 身体与技能效果的两个全局批次及共享材质。 */
export class VenomLobberRenderer {
  private readonly material = UnlitMaterialFactory.create('VenomLobberUnlit', {
    mainColor: new Color(255, 255, 255, 255),
    useVertexColor: true,
  });
  private readonly body: VenomLobberBodyRenderer;
  private readonly effects: VenomLobberEffectRenderer;
  private disposed = false;

  constructor(
    parent: Node,
    state: VenomLobberState,
    abilityEffects: VenomBombSystem,
    combat: Readonly<VenomLobberCombatOptions>,
    camera: Camera,
  ) {
    let body: VenomLobberBodyRenderer | null = null;
    let effects: VenomLobberEffectRenderer | null = null;
    try {
      body = new VenomLobberBodyRenderer(
        parent,
        state,
        combat,
        this.material,
        camera,
      );
      effects = new VenomLobberEffectRenderer(
        parent,
        state,
        abilityEffects,
        combat,
        this.material,
      );
    } catch (error: unknown) {
      effects?.dispose();
      body?.dispose();
      this.material.destroy();
      throw error;
    }
    if (body === null || effects === null) {
      this.material.destroy();
      throw new Error('Venom Lobber 渲染批次初始化结果缺失。');
    }
    this.body = body;
    this.effects = effects;
  }

  public get visibleEntityCount(): number {
    return this.body.activeEntityCount;
  }

  public update(): void {
    this.body.update();
    this.effects.update();
  }

  public isVisible(entityIndex: number): boolean {
    return this.body.isVisible(entityIndex);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.effects.dispose();
    this.body.dispose();
    this.material.destroy();
  }
}
