import { CURVE_CRAWLER_BODY_SHAPE } from './curve-crawler-body-shape';

const LEG_MAXIMUM_FORWARD_FAN = 0.72;
const LEG_STRIDE_SCALE = 0.18;
const LEG_TURN_STRIDE_EXPANSION = 0.28;
const FRONT_LEG_BITE_FORWARD_SCALE = 0.11;
const LEG_LATERAL_REACH_SCALE = 0.78;
const LEG_CROUCH_OUTWARD_SCALE = 0.12;
const FRONT_LEG_BITE_OUTWARD_SCALE = 0.035;
const FOOT_RADIUS_SCALE = 0.29 * 1.2;
const LEG_MAXIMUM_TURN_LIFT_EXPANSION = 0.12;
const FORGIVING_LEG_LATERAL_COVERAGE = 0.58;
const FORGIVING_LEG_BITE_LATERAL_EXPANSION = 0.035;
const FORGIVING_LEG_BITE_FORWARD_EXPANSION = 0.055;
const FORGIVING_LEG_TURN_FORWARD_EXPANSION = 0.018;
const FORGIVING_LEG_VERTICAL_COVERAGE = 0.03;

/** 近端腿部宽容碰撞体在蜘蛛局部坐标中的三个半轴。 */
export interface MutableCurveCrawlerHitExtents {
  forward: number;
  lateral: number;
  vertical: number;
}

/** 返回腹部与胸部可见中心之间的瞄准高度。 */
export function calculateCurveCrawlerAimElevation(
  bodyWidth: number,
  bodyPulse: number,
  crouchAmount: number,
  biteAmount: number,
): number {
  const shape = CURVE_CRAWLER_BODY_SHAPE;
  const visibleBodyWidth = calculateVisibleBodyWidth(bodyWidth, bodyPulse, crouchAmount);
  const abdomenRadius = visibleBodyWidth * shape.abdomenHeightRadiusScale;
  const thoraxRadius = visibleBodyWidth * shape.thoraxHeightRadiusScale;
  const abdomenCenter = abdomenRadius * (
    shape.abdomenCenterHeightScale - crouchAmount * shape.abdomenCrouchCenterScale
  );
  const thoraxCenter = thoraxRadius * (
    shape.thoraxCenterHeightScale
    - crouchAmount * shape.thoraxCrouchCenterScale
    - biteAmount * shape.thoraxBiteCenterScale
  );
  return (abdomenCenter + thoraxCenter) * 0.5;
}

/** 返回覆盖最前与最后脚尖的局部前后轴半宽。 */
export function calculateCurveCrawlerForwardHitHalfExtent(
  bodyLength: number,
  legLength: number,
  legWidth: number,
  bodyPulse: number,
  crouchAmount: number,
  biteAmount: number,
  turnAmount: number,
): number {
  const visibleBodyLength = bodyLength * Math.max(0, 1 + bodyPulse);
  const visibleLegLength = calculateVisibleLegLength(legLength, crouchAmount);
  const maximumStrideScale = LEG_STRIDE_SCALE * (
    1 + LEG_TURN_STRIDE_EXPANSION * turnAmount
  );
  return visibleBodyLength * 0.42
    + visibleLegLength * (
      LEG_MAXIMUM_FORWARD_FAN
      + maximumStrideScale
      + FRONT_LEG_BITE_FORWARD_SCALE * biteAmount
    )
    + legWidth * FOOT_RADIUS_SCALE;
}

/** 返回覆盖左右最远脚尖的局部侧向轴半宽。 */
export function calculateCurveCrawlerLateralHitHalfExtent(
  bodyWidth: number,
  legLength: number,
  legWidth: number,
  bodyPulse: number,
  crouchAmount: number,
  biteAmount: number,
): number {
  const visibleBodyWidth = calculateVisibleBodyWidth(bodyWidth, bodyPulse, crouchAmount);
  const visibleLegLength = calculateVisibleLegLength(legLength, crouchAmount);
  return visibleBodyWidth * 0.4
    + visibleLegLength * (
      LEG_LATERAL_REACH_SCALE * (1 + crouchAmount * LEG_CROUCH_OUTWARD_SCALE)
      + biteAmount * FRONT_LEG_BITE_OUTWARD_SCALE
    )
    + legWidth * FOOT_RADIUS_SCALE;
}

/** 返回以瞄准高度为中心并覆盖身体、抬腿与远端脚掌的竖直轴半高。 */
export function calculateCurveCrawlerVerticalHitHalfExtent(
  bodyWidth: number,
  legLength: number,
  legWidth: number,
  bodyPulse: number,
  crouchAmount: number,
  biteAmount: number,
  turnAmount: number,
): number {
  const shape = CURVE_CRAWLER_BODY_SHAPE;
  const visibleBodyWidth = calculateVisibleBodyWidth(bodyWidth, bodyPulse, crouchAmount);
  const visibleLegLength = calculateVisibleLegLength(legLength, crouchAmount);
  const abdomenRadius = visibleBodyWidth * shape.abdomenHeightRadiusScale;
  const thoraxRadius = visibleBodyWidth * shape.thoraxHeightRadiusScale;
  const abdomenCenter = abdomenRadius * (
    shape.abdomenCenterHeightScale - crouchAmount * shape.abdomenCrouchCenterScale
  );
  const thoraxCenter = thoraxRadius * (
    shape.thoraxCenterHeightScale
    - crouchAmount * shape.thoraxCrouchCenterScale
    - biteAmount * shape.thoraxBiteCenterScale
  );
  const centerElevation = (abdomenCenter + thoraxCenter) * 0.5;
  const footRadius = legWidth * FOOT_RADIUS_SCALE;
  const maximumLiftScale = 1 + turnAmount * LEG_MAXIMUM_TURN_LIFT_EXPANSION;
  const upperLegTop = visibleBodyWidth * (0.28 - crouchAmount * 0.05)
    + visibleLegLength * 0.13
    + legWidth * 0.5;
  const middleLegTop = footRadius
    + visibleLegLength * (0.08 + 0.11 * maximumLiftScale * 0.55)
    + legWidth * 0.5;
  const distalLegTop = footRadius * 2
    + visibleLegLength * 0.11 * maximumLiftScale;
  const minimumHeight = Math.min(
    0,
    abdomenCenter - abdomenRadius,
    thoraxCenter - thoraxRadius,
  );
  const maximumHeight = Math.max(
    abdomenCenter + abdomenRadius,
    thoraxCenter + thoraxRadius,
    upperLegTop,
    middleLegTop,
    distalLegTop,
  );
  return Math.max(
    centerElevation - minimumHeight,
    maximumHeight - centerElevation,
  );
}

/** 把覆盖身体与近端腿部约六成长度的扁平碰撞体半轴写入复用结果。 */
export function writeCurveCrawlerForgivingHitExtents(
  bodyLength: number,
  bodyWidth: number,
  legLength: number,
  legWidth: number,
  bodyPulse: number,
  crouchAmount: number,
  biteAmount: number,
  turnAmount: number,
  result: MutableCurveCrawlerHitExtents,
): void {
  const visibleBodyLength = bodyLength * Math.max(0, 1 + bodyPulse);
  const visibleBodyWidth = calculateVisibleBodyWidth(bodyWidth, bodyPulse, crouchAmount);
  const visibleLegLength = calculateVisibleLegLength(legLength, crouchAmount);
  result.forward = visibleBodyLength * 0.55
    + visibleLegLength * (
      FORGIVING_LEG_BITE_FORWARD_EXPANSION * biteAmount
      + FORGIVING_LEG_TURN_FORWARD_EXPANSION * turnAmount
    )
    + legWidth * FOOT_RADIUS_SCALE;
  result.lateral = visibleBodyWidth * 0.45
    + visibleLegLength * (
      FORGIVING_LEG_LATERAL_COVERAGE
      + FORGIVING_LEG_BITE_LATERAL_EXPANSION * biteAmount
    )
    + legWidth * FOOT_RADIUS_SCALE;
  result.vertical = visibleBodyWidth * 0.35
    + visibleLegLength * FORGIVING_LEG_VERTICAL_COVERAGE * turnAmount
    + legWidth * FOOT_RADIUS_SCALE;
}

function calculateVisibleBodyWidth(
  bodyWidth: number,
  bodyPulse: number,
  crouchAmount: number,
): number {
  return bodyWidth * Math.max(0, 1 - bodyPulse * 0.35 - crouchAmount * 0.08);
}

function calculateVisibleLegLength(legLength: number, crouchAmount: number): number {
  return legLength * Math.max(0, 1 + crouchAmount * 0.08);
}
