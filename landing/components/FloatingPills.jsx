'use client';

import { motion, useReducedMotion } from 'framer-motion';

const GUESTS = [
  'Shreyas Doshi', 'Shishir Mehrotra', 'Gokul Rajaram', 'Bangaly Kaba',
  'Casey Winters', 'Elena Verna', 'Deb Liu', 'Jeff Weinstein',
  'Maggie Crowley', 'Lenny Rachitsky', 'Merci Victoria Grace', 'Nikita Bier',
  'Paul Adams', 'Ravi Mehta', 'Scott Belsky', 'Jackie Bavaro',
  'Wes Kao', 'Adam Nash', 'Julie Zhuo', 'Mihika Kapoor',
];

export default function FloatingPills() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
      {GUESTS.map((name, i) => (
        <motion.span
          key={name}
          className="px-4 py-2 bg-white rounded-full text-sm shadow-sm border border-gray-100"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
          animate={
            reduceMotion
              ? undefined
              : {
                  y: [0, -6, 0, 6, 0],
                  transition: {
                    duration: 3 + (i % 3),
                    repeat: Infinity,
                    repeatType: 'loop',
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  },
                }
          }
        >
          {name}
        </motion.span>
      ))}
    </div>
  );
}
