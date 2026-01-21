interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type?: 'horizontal' | 'stepped';
}

/**
 * SVG connection line between family units
 * Supports horizontal straight lines or stepped (L-shaped) connections
 */
export function ConnectionLine({ x1, y1, x2, y2, type = 'stepped' }: ConnectionLineProps) {
  if (type === 'horizontal') {
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  // Stepped connection: horizontal, then vertical, then horizontal
  const midX = (x1 + x2) / 2;

  const pathD = `
    M ${x1} ${y1}
    L ${midX} ${y1}
    L ${midX} ${y2}
    L ${x2} ${y2}
  `;

  return (
    <path
      d={pathD}
      fill="none"
      stroke="#4b5563"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

interface FamilyConnectionProps {
  // Source position (right side of child card)
  sourceX: number;
  sourceY: number;
  // Father target position (left side of father card)
  fatherX?: number;
  fatherY?: number;
  // Mother target position (left side of mother card)
  motherX?: number;
  motherY?: number;
}

/**
 * Connection from a person/unit to their parent family unit
 * Creates a branching line that connects to both father and mother if present
 */
export function FamilyConnection({
  sourceX,
  sourceY,
  fatherX,
  fatherY,
  motherX,
  motherY
}: FamilyConnectionProps) {
  // Calculate midpoint for branching
  const targetX = fatherX ?? motherX ?? sourceX;
  const midX = sourceX + (targetX - sourceX) / 2;

  const paths: JSX.Element[] = [];

  // Draw horizontal line from source to mid
  paths.push(
    <line
      key="source-mid"
      x1={sourceX}
      y1={sourceY}
      x2={midX}
      y2={sourceY}
      stroke="#4b5563"
      strokeWidth={2}
      strokeLinecap="round"
    />
  );

  // If both parents exist, draw vertical connector and branches
  if (fatherX !== undefined && fatherY !== undefined && motherX !== undefined && motherY !== undefined) {
    // Vertical line connecting father and mother levels
    paths.push(
      <line
        key="vertical"
        x1={midX}
        y1={fatherY}
        x2={midX}
        y2={motherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );

    // Horizontal line to father
    paths.push(
      <line
        key="to-father"
        x1={midX}
        y1={fatherY}
        x2={fatherX}
        y2={fatherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );

    // Horizontal line to mother
    paths.push(
      <line
        key="to-mother"
        x1={midX}
        y1={motherY}
        x2={motherX}
        y2={motherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  } else if (fatherX !== undefined && fatherY !== undefined) {
    // Only father - simple L-shaped connection
    paths.push(
      <line
        key="vertical-father"
        x1={midX}
        y1={sourceY}
        x2={midX}
        y2={fatherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
    paths.push(
      <line
        key="to-father"
        x1={midX}
        y1={fatherY}
        x2={fatherX}
        y2={fatherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  } else if (motherX !== undefined && motherY !== undefined) {
    // Only mother - simple L-shaped connection
    paths.push(
      <line
        key="vertical-mother"
        x1={midX}
        y1={sourceY}
        x2={midX}
        y2={motherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
    paths.push(
      <line
        key="to-mother"
        x1={midX}
        y1={motherY}
        x2={motherX}
        y2={motherY}
        stroke="#4b5563"
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  return <>{paths}</>;
}
