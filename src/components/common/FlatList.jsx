import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * FlatList component for high-performance virtualized scrolling
 * Renders ONLY visible rows in the DOM (plus buffer), maintaining 60 FPS even with 10,000+ items.
 */
export default function FlatList({
  data = [],
  rowHeight = 54,
  maxHeight = 'calc(100vh - 280px)',
  renderItem,
  keyExtractor = (item, i) => item.id || i,
  HeaderComponent,
  EmptyComponent,
  overscan = 5,
  asTable = true,
  tableClassName = 'data-table',
  containerStyle = {},
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const handleResize = () => {
      setViewportHeight(el.clientHeight || 600);
    };

    handleResize();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const totalCount = data.length;

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);

  const visibleData = useMemo(() => {
    return data.slice(startIndex, endIndex).map((item, idx) => ({
      item,
      actualIndex: startIndex + idx,
    }));
  }, [data, startIndex, endIndex]);

  const paddingTop = startIndex * rowHeight;
  const paddingBottom = Math.max(0, (totalCount - endIndex) * rowHeight);

  if (totalCount === 0) {
    return EmptyComponent ? <EmptyComponent /> : null;
  }

  if (asTable) {
    return (
      <div
        ref={containerRef}
        className="flat-list-container table-container"
        style={{
          maxHeight,
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
          WebkitOverflowScrolling: 'touch',
          ...containerStyle,
        }}
      >
        <table className={tableClassName} style={{ width: '100%', borderCollapse: 'collapse' }}>
          {HeaderComponent && <HeaderComponent />}
          <tbody>
            {paddingTop > 0 && (
              <tr style={{ height: `${paddingTop}px` }}>
                <td colSpan={100} style={{ padding: 0, border: 'none', height: `${paddingTop}px` }} />
              </tr>
            )}
            {visibleData.map(({ item, actualIndex }) => (
              <tr key={keyExtractor(item, actualIndex)} style={{ height: `${rowHeight}px` }}>
                {renderItem(item, actualIndex)}
              </tr>
            ))}
            {paddingBottom > 0 && (
              <tr style={{ height: `${paddingBottom}px` }}>
                <td colSpan={100} style={{ padding: 0, border: 'none', height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flat-list-container"
      style={{
        maxHeight,
        overflowY: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
        ...containerStyle,
      }}
    >
      <div style={{ paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px` }}>
        {visibleData.map(({ item, actualIndex }) =>
          renderItem(item, actualIndex)
        )}
      </div>
    </div>
  );
}
