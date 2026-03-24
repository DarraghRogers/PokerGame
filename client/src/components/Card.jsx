const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
};

export default function Card({ card, small }) {
  if (!card) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`}>
        <span className="card-back-design">♠♥</span>
      </div>
    );
  }

  const color = suitColors[card.suit];

  return (
    <div className={`card card-face ${small ? 'card-small' : ''}`} data-color={color}>
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{suitSymbols[card.suit]}</span>
    </div>
  );
}
