import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "altcha-widget": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          challenge?: string;       // v3: URL zum Challenge-Endpoint
          challengeurl?: string;    // v2: deprecated, nicht mehr verwendet
          name?: string;
          hidefooter?: boolean | string;
          hidelogo?: boolean | string;
          language?: string;
        },
        HTMLElement
      >;
    }
  }
}
