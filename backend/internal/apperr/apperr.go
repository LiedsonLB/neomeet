package apperr

// AppError is a plain error with an attached HTTP status code, used the same
// way the Laravel code threw `new \Exception($message, $code)` everywhere.
type AppError struct {
	Message string
	Status  int
}

func (e *AppError) Error() string { return e.Message }

func New(message string, status int) *AppError {
	return &AppError{Message: message, Status: status}
}

// As tries to unwrap err into an *AppError, returning (err, true) on success.
func As(err error) (*AppError, bool) {
	ae, ok := err.(*AppError)
	return ae, ok
}
