export default function ExternalLink(props: React.ComponentProps<"svg">) {
   return (
      <svg
         viewBox="0 0 28 28"
         fill="none"
         xmlns="http://www.w3.org/2000/svg"
         {...props}
      >
         <g clipPath="url(#clip0_169_2262)">
            <path
               d="M13.9974 7H6.9974C6.37856 7 5.78506 7.24583 5.34748 7.68342C4.9099 8.121 4.66406 8.71449 4.66406 9.33333V21C4.66406 21.6188 4.9099 22.2123 5.34748 22.6499C5.78506 23.0875 6.37856 23.3333 6.9974 23.3333H18.6641C19.2829 23.3333 19.8764 23.0875 20.314 22.6499C20.7516 22.2123 20.9974 21.6188 20.9974 21V14"
               stroke="white"
               strokeWidth={2}
               strokeLinecap="round"
               strokeLinejoin="round"
            />
            <path
               d="M12.8359 15.168L23.3359 4.66797"
               stroke="white"
               strokeWidth={2}
               strokeLinecap="round"
               strokeLinejoin="round"
            />
            <path
               d="M17.5 4.66797H23.3333V10.5013"
               stroke="white"
               strokeWidth={2}
               strokeLinecap="round"
               strokeLinejoin="round"
            />
         </g>
         <defs>
            <clipPath id="clip0_169_2262">
               <rect width={28} height={28} fill="white" />
            </clipPath>
         </defs>
      </svg>
   );
}
