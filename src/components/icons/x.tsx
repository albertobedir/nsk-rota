export default function X(props: React.ComponentProps<"svg">) {
   return (
      <svg
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth={2}
         strokeLinecap="round"
         strokeLinejoin="round"
         {...props}
      >
         <path d="M18 6 6 18" />
         <path d="m6 6 12 12" />
      </svg>
   );
}
