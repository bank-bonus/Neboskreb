import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  stars: number; // 0 to 3
  animated?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({ stars, animated = false }) => {
  return (
    <div className="flex gap-2 justify-center mb-4">
      {[1, 2, 3].map((index) => {
        const isFilled = index <= stars;
        const delayClass = animated ? `delay-${(index - 1) * 200}` : '';
        
        return (
          <div 
            key={index} 
            className={`transition-all duration-500 transform ${animated && isFilled ? 'scale-110' : 'scale-100'}`}
            style={{ transitionDelay: `${(index - 1) * 150}ms` }}
          >
            <Star 
              size={48} 
              className={`
                ${isFilled ? 'fill-yellow-400 text-yellow-500 drop-shadow-lg' : 'fill-gray-700 text-gray-600'}
                ${animated && isFilled ? 'animate-float' : ''}
              `}
              strokeWidth={3}
            />
          </div>
        );
      })}
    </div>
  );
};