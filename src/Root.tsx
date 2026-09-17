import "./index.css";
import { ScaleRevealComposition } from "./ScaleReveal";
import { GroupSplitComposition } from "./GroupSplit";
import { CalorieBarsComposition } from "./CalorieBars";
import { ProgressRevealComposition } from "./ProgressReveal";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ScaleRevealComposition />
      <GroupSplitComposition />
      <CalorieBarsComposition />
      <ProgressRevealComposition />
    </>
  );
};
