const ImagesBar = () => {
  return (
    <div style={styles.container}>
      <img src="/images/logo_gov_piaui.svg" style={styles.img} />
      <img src="/images/logo_uespi.svg" style={{ ...styles.img, height: 26 }} />
      <img src="/images/logo_letras.svg" style={styles.img} />
      <img src="/images/logo_leia.svg" style={styles.img} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 28,
    flexWrap: 'wrap',
  },
  img: {
    height: 32,
    objectFit: 'contain',
    opacity: 0.9,
  },
};

export default ImagesBar;