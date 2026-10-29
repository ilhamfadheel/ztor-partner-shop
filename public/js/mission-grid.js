// Equal-width mission columns retain source order; each card follows its column's height.
let observer;
export function layoutMissionGrid(grid) {
  observer?.disconnect();
  if (!grid) return;
  let frame=0;
  const layout=()=>{
    frame=0;
    const cards=[...grid.children];
    cards.forEach(card=>card.style.gridArea='');
    const style=getComputedStyle(grid);
    const columns=style.gridTemplateColumns.split(' ').length;
    const gap=parseFloat(style.columnGap)||0;
    const ends=Array(columns).fill(1);
    cards.forEach((card,i)=>card.style.gridColumn=String(i%columns+1));
    cards.forEach((card,i)=>{
      const column=i%columns;
      const span=Math.ceil(card.getBoundingClientRect().height+gap);
      card.style.gridColumn=String(column+1);
      card.style.gridRow=`${ends[column]} / span ${span}`;
      ends[column]+=span;
    });
  };
  grid.classList.add('mission-masonry');
  layout();
  observer=new ResizeObserver(()=>{if(!frame)frame=requestAnimationFrame(layout);});
  observer.observe(grid);
  [...grid.children].forEach(card=>observer.observe(card));
}

