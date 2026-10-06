declare module '@3d-dice/dice-box-threejs' {
  export interface DiceBoxColorset {
    name: string;
    foreground?: string;
    background?: string;
    outline?: string;
    edge?: string;
    texture?: string;
    material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
  }

  export interface DiceBoxConfig {
    framerate?: number;
    sounds?: boolean;
    shadows?: boolean;
    theme_customColorset?: DiceBoxColorset | null;
    theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<void>;
    /** Notation like `2d20+1d6@14,3,5`: dice land on the listed values, in order. */
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
    resizeWorld(): void;
  }
}
