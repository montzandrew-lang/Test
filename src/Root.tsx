import "./index.css";
import { ScaleRevealComposition } from "./ScaleReveal";
import { GroupSplitComposition } from "./GroupSplit";
import { CalorieBarsComposition } from "./CalorieBars";
import { ProgressRevealComposition } from "./ProgressReveal";
import { DeflationComposition } from "./Deflation";
import { RewardStudyComposition } from "./RewardStudy";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ScaleRevealComposition />
      <GroupSplitComposition />
      <CalorieBarsComposition />
      <ProgressRevealComposition />
      <DeflationComposition />
      <RewardStudyComposition />
    </>
  );
};
