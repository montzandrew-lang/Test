import "./index.css";
import { ScaleRevealComposition } from "./ScaleReveal";
import { GroupSplitComposition } from "./GroupSplit";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ScaleRevealComposition />
      <GroupSplitComposition />
    </>
  );
};
