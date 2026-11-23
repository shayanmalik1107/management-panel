import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

/**
 * FlatList component for high-performance lazy & virtualized scrolling
 * Loads ONLY the initial viewable slice (25 items) when page opens.
 * As the user scrolls down, it progressively loads subsequent batches (+25 items),
 * keeping initial page load instantaneous and zero lag.
 */
export default function FlatList({
  data = [],
  rowHeight = 54,
  maxHeight = 'calc(100vh - 280px)',
  renderItem,
  keyExtractor = (item, i) => item.id || i,
  HeaderComponent,
  EmptyComponent,
  initialBatchSize = 25,
  batchIncrement = 25,
  asTable = true,
  tableClassName = 'data-table',
  containerStyle = {},
}) {
  const containerRef = useRef(null);
  const [renderedCount, setRenderedCount] = useState(initialBatchSize);
  const [isScrollLoading, setIsScrollLoading] = useState(false);

  // Reset rendered count whenever data set changes (e.g. search/filtering/tab change)
  useEffect(() => {
    setRenderedCount(initialBatchSize);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [data, initialBatchSize]);

  // Handle scroll to load next batch when near bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, clientHeight, scrollHeight } = el;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

    if (distanceToBottom < 180 && renderedCount < data.length && !isScrollLoading) {
      setIsScrollLoading(true);
      setRenderedCount((prev) => Math.min(data.length, prev + batchIncrement));
      setTimeout(() => setIsScrollLoading(false), 50);
    }
  }, [data.length, renderedCount, batchIncrement, isScrollLoading]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const totalCount = data.length;
  const currentBatch = useMemo(() => {
    return data.slice(0, renderedCount);
  }, [data, renderedCount]);

  if (totalCount === 0) {
    return EmptyComponent ? <EmptyComponent /> : null;
  }

  if (asTable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
          <table className={tableClassName} style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
            {HeaderComponent && <HeaderComponent />}
            <tbody>
              {currentBatch.map((item, index) => (
                <tr key={keyExtractor(item, index)} style={{ height: `${rowHeight}px` }}>
                  {renderItem(item, index)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {/* Footer info bar showing loaded item count */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--gray-50)',
            borderTop: '1px solid var(--gray-200)',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--gray-500)',
            fontWeight: 500,
          }}
        >
          <span>
            Showing <strong>{currentBatch.length}</strong> of <strong>{totalCount}</strong> entries
          </span>
          {currentBatch.length < totalCount ? (
            <span style={{ color: 'var(--primary-600)', fontStyle: 'italic' }}>
              Scroll down to load more items (+25)...
            </span>
          ) : (
            <span style={{ color: 'var(--success-600)' }}>✓ All entries loaded</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
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
        {currentBatch.map((item, index) => renderItem(item, index))}
      </div>

      <div
        style={{
          padding: '8px 16px',
          background: 'var(--gray-50)',
          borderTop: '1px solid var(--gray-200)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--gray-500)',
          fontWeight: 500,
        }}
      >
        <span>
          Showing <strong>{currentBatch.length}</strong> of <strong>{totalCount}</strong> entries
        </span>
        {currentBatch.length < totalCount ? (
          <span style={{ color: 'var(--primary-600)', fontStyle: 'italic' }}>
            Scroll down to load more items (+25)...
          </span>
        ) : (
          <span style={{ color: 'var(--success-600)' }}>✓ All entries loaded</span>
        )}
      </div>
    </div>
  );
}
