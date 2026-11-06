import { motion } from "framer-motion";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  /** Share of the element that must be on screen before it fades in. */
  amount?: number;
};

export function Reveal({ children, delay = 0, amount = 0.25 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
