export default function ChevronRight(props: React.ComponentProps<"svg">) {
   return (
      <svg
         width={12}
         height={20}
         viewBox="0 0 12 20"
         fill="currentColor"
         xmlns="http://www.w3.org/2000/svg"
         {...props}
      >
         <g clipPath="url(#clip0_5_58)">
            <path
               d="M0.418417 19.5816C-0.139483 19.0237 -0.139483 18.1192 0.418417 17.5613L7.97972 10L0.418419 2.4387C-0.139481 1.8808 -0.139481 0.9763 0.418419 0.4184C0.976319 -0.1395 1.88082 -0.1395 2.43874 0.4184L11.0102 8.9898C11.5681 9.5477 11.5681 10.4523 11.0102 11.0102L2.43874 19.5816C1.88082 20.1395 0.976317 20.1395 0.418417 19.5816Z"
               fill="currentColor"
            />
         </g>
         <defs>
            <clipPath id="clip0_5_58">
               <rect
                  width={12}
                  height={20}
                  fill="currentColor"
                  transform="translate(12 20) rotate(-180)"
               />
            </clipPath>
         </defs>
      </svg>
   );
}
