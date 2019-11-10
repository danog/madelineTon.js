const posMod = (a, b) => {
    const r = -a % b
    return r < 0 ? r + b : r
}

export {
    posMod
}