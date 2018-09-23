class Position {

	constructor(x, y) 
	{
		this.x = x;
		this.y = y;
	}

	equals(other)
	{
		return this.x === other.x && this.y === other.y;
	}

	nextField(direction)
	{
		if (direction === 'right') {
			return new Position(this.x + 1, this.y);
		}
		if (direction === 'left') {
			return new Position(this.x - 1, this.y);
		}
		if (direction === 'up') {
			return new Position(this.x, this.y - 1);
		}
		if (direction === 'down') {
			return new Position(this.x, this.y + 1);
		}
	}
}

module.exports = Position