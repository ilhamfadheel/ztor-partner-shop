import Link from "next/link";
import { StateMessage } from "@/components/StateMessage";

export default function NotFound() {
  return (
    <StateMessage heading="h1" icon="search" title="We can’t find that page" actions={<Link href="/" className="btn btn-primary">Back to the shop</Link>}>
      <p>The product may have been taken down, or the link is incomplete.</p>
    </StateMessage>
  );
}
