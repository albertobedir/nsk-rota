import {
  FileText,
  MailOpen,
  Menu,
  MoveRight,
  ShoppingBasket,
} from "lucide-react";
import ChevronRight from "./chevron-right";
import ExternalLink from "./external-link";
import Eye from "./eye";
import EyeOff from "./eye-off";
import MultipleSearch from "./multiple-search";
import Search from "./search";
import SingleSearch from "./single-search";
import X from "./x";
import Konum from "./konum";
import Stock from "./stock";
import Delivery from "./delivery";

type IconName =
  | "eye"
  | "eye-off"
  | "external-link"
  | "search"
  | "single-search"
  | "multiple-search"
  | "chevron-right"
  | "x"
  | "file-text"
  | "menu"
  | "shopping-basket"
  | "mail-open"
  | "move-right"
  | "konum"
  | "stock"
  | "teslim";

interface Props extends React.ComponentProps<"svg"> {
  name: IconName;
}

export default function Icons({
  name,
  width = 24,
  height = 24,
  ...props
}: Props) {
  const iconProps = {
    width,
    height,
    ...props,
  };

  switch (name) {
    case "eye":
      return <Eye {...iconProps} />;
    case "eye-off":
      return <EyeOff {...iconProps} />;
    case "external-link":
      return <ExternalLink {...iconProps} />;
    case "search":
      return <Search {...iconProps} />;
    case "single-search":
      return <SingleSearch {...iconProps} />;
    case "multiple-search":
      return <MultipleSearch {...iconProps} />;
    case "chevron-right":
      return <ChevronRight {...iconProps} />;
    case "x":
      return <X {...iconProps} />;
    case "file-text":
      return <FileText {...iconProps} />;
    case "menu":
      return <Menu {...iconProps} />;
    case "shopping-basket":
      return <ShoppingBasket {...iconProps} />;
    case "mail-open":
      return <MailOpen {...iconProps} />;
    case "move-right":
      return <MoveRight {...iconProps} />;
    case "konum":
      return <Konum {...iconProps} />;
    case "stock":
      return <Stock {...iconProps} />;
    case "teslim":
      return <Delivery {...iconProps} />;
    default:
      return null;
  }
}
